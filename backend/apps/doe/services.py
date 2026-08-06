from itertools import product
from math import exp, isfinite, lgamma, log, sqrt
from typing import Any


def generate_design(factors, design_type="full_factorial"):
    k = len(factors)
    trials = []

    if design_type == "box_behnken" and k >= 3:
        # Box-Behnken Design generator for k factors
        combinations = []
        for i in range(k):
            for j in range(i + 1, k):
                for s1 in [-1.0, 1.0]:
                    for s2 in [-1.0, 1.0]:
                        point = [0.0] * k
                        point[i] = s1
                        point[j] = s2
                        combinations.append(point)
        # Add 3 center points
        for _ in range(3):
            combinations.append([0.0] * k)

        for index, point in enumerate(combinations, start=1):
            row = {"trial": index}
            for f_idx, factor in enumerate(factors):
                low, high = float(factor["low"]), float(factor["high"])
                mid = (low + high) / 2.0
                half_range = (high - low) / 2.0
                val = mid + point[f_idx] * half_range
                row[factor["name"]] = round(val, 4)
            trials.append(row)
        return trials

    elif design_type == "central_composite" and k >= 2:
        # Central Composite Design (CCD) generator
        alpha = sqrt(k)  # Spherical CCD
        combinations = []
        # Factorial points
        for levels in product(*[[-1.0, 1.0] for _ in range(k)]):
            combinations.append(list(levels))
        # Axial points
        for i in range(k):
            p1 = [0.0] * k; p1[i] = alpha; combinations.append(p1)
            p2 = [0.0] * k; p2[i] = -alpha; combinations.append(p2)
        # Center points
        for _ in range(3):
            combinations.append([0.0] * k)

        for index, point in enumerate(combinations, start=1):
            row = {"trial": index}
            for f_idx, factor in enumerate(factors):
                low, high = float(factor["low"]), float(factor["high"])
                mid = (low + high) / 2.0
                half_range = (high - low) / 2.0
                val = mid + point[f_idx] * half_range
                row[factor["name"]] = round(val, 4)
            trials.append(row)
        return trials

    # Default: 2^k Full Factorial Design
    for index, levels in enumerate(
        product(*[(float(factor["low"]), float(factor["high"])) for factor in factors]), start=1
    ):
        trials.append({
            "trial": index,
            **{factor["name"]: level for factor, level in zip(factors, levels)},
        })
    return trials


def _calculate_individual_desirability(val, goal):
    direction = goal.get("direction", "maximize")
    target = float(goal.get("target", 0.0))
    low = float(goal.get("low", target * 0.5 if direction != "minimize" else target))
    high = float(goal.get("high", target * 1.5 if direction != "maximize" else target))
    
    if direction == "maximize":
        if val <= low: return 0.0
        if val >= high: return 1.0
        return (val - low) / (high - low) if high > low else 1.0
    elif direction == "minimize":
        if val >= high: return 0.0
        if val <= low: return 1.0
        return (high - val) / (high - low) if high > low else 1.0
    else: # target
        if val < low or val > high: return 0.0
        if val == target: return 1.0
        if val < target:
            return (val - low) / (target - low) if target > low else 1.0
        else:
            return (high - val) / (high - target) if high > target else 1.0


def rank_trials(trials, goals):
    prepared = []
    desirability_keys = []
    
    for trial in trials:
        score = 0.0
        d_scores = []
        weights = []
        valid = True
        
        for goal in goals:
            resp_name = goal.get("response")
            val = trial.get(resp_name)
            try:
                val = float(val)
            except (TypeError, ValueError):
                valid = False
                continue
            
            d_i = _calculate_individual_desirability(val, goal)
            weight = max(float(goal.get("weight", 1.0)), 0.1)
            
            trial[f"d_{resp_name}"] = round(d_i, 4)
            d_scores.append(d_i)
            weights.append(weight)
            
            target = float(goal.get("target", 0))
            direction = goal.get("direction", "maximize")
            component = (
                val if direction == "maximize"
                else -val if direction == "minimize"
                else -abs(val - target)
            )
            score += component * weight

        # Derringer–Suich Composite Desirability Score (D)
        if valid and d_scores and sum(weights) > 0:
            weighted_log_sum = sum(w * (log(max(d, 1e-6))) for d, w in zip(d_scores, weights))
            composite_d = round(exp(weighted_log_sum / sum(weights)), 4)
        else:
            composite_d = 0.0

        prepared.append({
            **trial,
            "desirability_score": composite_d,
            "optimization_score": round(score, 6),
            "complete": valid
        })

    # Sort primarily by Derringer Desirability Score (D) descending
    return sorted(prepared, key=lambda row: (row["desirability_score"], row["optimization_score"]), reverse=True)



def analyze_stability(
    observations: list[dict[str, Any]],
    response_name: str = "Response",
    upper_limit: float | None = None,
    lower_limit: float | None = None,
    confidence_level: float = 0.95,
    pooling_alpha: float = 0.25,
    maximum_prediction_month: float = 60,
    prediction_month: float | None = None,
    prediction_formulation: str = "",
) -> dict[str, Any]:
    """Fit Minitab-inspired stability models and estimate shelf life.

    Formulation slopes are compared before intercepts. The fitted mean's
    one-sided confidence bound is used when one specification limit is given;
    two-sided bounds are used when both limits are supplied.
    """

    clean = [
        {
            "month": float(row["month"]),
            "formulation": str(row["formulation"]).strip(),
            "response": float(row["response"]),
        }
        for row in observations
        if str(row.get("formulation", "")).strip()
    ]
    if len(clean) < 3:
        raise ValueError("At least three valid observations are required.")
    if len({row["month"] for row in clean}) < 2:
        raise ValueError("At least two different testing months are required.")

    formulations = sorted({row["formulation"] for row in clean})
    pooled_model = _fit_model(clean, formulations, "pooled")
    slopes_p_value = None
    intercepts_p_value = None

    if len(formulations) == 1:
        selected_model = pooled_model
        model_type = "Single formulation regression"
        pooling_tests = [{
            "test": "Formulation comparison",
            "p_value": None,
            "significance_level": pooling_alpha,
            "decision": "Only one formulation type was supplied",
        }]
    else:
        common_slope_model = _fit_model(clean, formulations, "common")
        individual_slope_model = _fit_model(clean, formulations, "individual")
        slopes_p_value = _nested_model_p_value(common_slope_model, individual_slope_model)
        intercepts_p_value = _nested_model_p_value(pooled_model, common_slope_model)

        if slopes_p_value is not None and slopes_p_value < pooling_alpha:
            selected_model = individual_slope_model
            model_type = "Individual slopes and intercepts"
            slope_decision = "Slopes differ; formulation types cannot be pooled"
            intercept_decision = "Intercept comparison not applied because slopes differ"
        elif intercepts_p_value is not None and intercepts_p_value < pooling_alpha:
            selected_model = common_slope_model
            model_type = "Common slope with individual intercepts"
            slope_decision = "Slopes do not differ significantly"
            intercept_decision = "Intercepts differ; formulation types remain separate"
        else:
            selected_model = pooled_model
            model_type = "Pooled formulation types"
            slope_decision = "Slopes do not differ significantly"
            intercept_decision = "Intercepts do not differ significantly"

        pooling_tests = [
            {
                "test": "Equality of slopes",
                "p_value": slopes_p_value,
                "significance_level": pooling_alpha,
                "decision": slope_decision,
            },
            {
                "test": "Equality of intercepts",
                "p_value": intercepts_p_value,
                "significance_level": pooling_alpha,
                "decision": intercept_decision,
            },
        ]

    maximum_prediction_month = max(
        float(maximum_prediction_month), max(row["month"] for row in clean)
    )
    time_grid = [maximum_prediction_month * index / 240 for index in range(241)]
    curves: dict[str, list[dict[str, float]]] = {}
    shelf_lives: list[dict[str, Any]] = []

    for formulation in formulations:
        curve = _prediction_curve(
            selected_model,
            formulation,
            time_grid,
            confidence_level,
            upper_limit is not None,
            lower_limit is not None,
        )
        shelf = _shelf_life(curve, upper_limit, lower_limit)
        shelf_lives.append({"formulation": formulation, **shelf})
        curves[formulation] = curve

    reached = [row for row in shelf_lives if row["shelf_life"] is not None]
    limiting = min(reached, key=lambda row: row["shelf_life"]) if reached else None
    prediction = None

    if prediction_month is not None:
        selected_formulation = prediction_formulation or formulations[0]
        if selected_formulation not in formulations:
            raise ValueError("The selected formulation is not present in the worksheet.")
        point = _prediction_curve(
            selected_model,
            selected_formulation,
            [float(prediction_month)],
            confidence_level,
            upper_limit is not None,
            lower_limit is not None,
        )[0]
        within_specification = True
        if upper_limit is not None:
            within_specification = within_specification and point["upper_bound"] <= upper_limit
        if lower_limit is not None:
            within_specification = within_specification and point["lower_bound"] >= lower_limit
        prediction = {
            **point,
            "formulation": selected_formulation,
            "within_specification": within_specification,
        }

    return {
        "response_name": response_name.strip() or "Response",
        "model_type": model_type,
        "formulations": formulations,
        "r_squared": selected_model["r_squared"],
        "adjusted_r_squared": selected_model["adjusted_r_squared"],
        "confidence_level": confidence_level,
        "upper_limit": upper_limit,
        "lower_limit": lower_limit,
        "pooling_tests": pooling_tests,
        "shelf_lives": shelf_lives,
        "overall_shelf_life": limiting["shelf_life"] if limiting else None,
        "limiting_formulation": limiting["formulation"] if limiting else None,
        "model_parameters": [
            {"parameter": name, "estimate": estimate}
            for name, estimate in zip(selected_model["names"], selected_model["beta"])
        ],
        "observations": sorted(clean, key=lambda row: (row["formulation"], row["month"])),
        "curves": curves,
        "prediction": prediction,
    }


def _fit_model(
    observations: list[dict[str, Any]], formulations: list[str], kind: str
) -> dict[str, Any]:
    matrix = [_design_row(row["month"], row["formulation"], formulations, kind) for row in observations]
    response = [row["response"] for row in observations]
    parameter_count = len(matrix[0])
    if len(observations) <= parameter_count:
        raise ValueError("Add more observations to compare the supplied formulation types.")

    xtx = [[sum(row[i] * row[j] for row in matrix) for j in range(parameter_count)] for i in range(parameter_count)]
    inverse = _invert_matrix(xtx)
    xty = [sum(row[i] * value for row, value in zip(matrix, response)) for i in range(parameter_count)]
    beta = [sum(inverse[i][j] * xty[j] for j in range(parameter_count)) for i in range(parameter_count)]
    fitted = [sum(coefficient * value for coefficient, value in zip(beta, row)) for row in matrix]
    residuals = [actual - predicted for actual, predicted in zip(response, fitted)]
    rss = sum(value * value for value in residuals)
    mean_response = sum(response) / len(response)
    tss = sum((value - mean_response) ** 2 for value in response)
    degrees_of_freedom = len(response) - parameter_count
    r_squared = 1.0 - rss / tss if tss > 0 else 1.0
    adjusted = 1.0 - (1.0 - r_squared) * (len(response) - 1) / degrees_of_freedom

    names = ["Intercept", "Month"]
    if kind in {"common", "individual"}:
        names += [f"Intercept: {formulation}" for formulation in formulations[1:]]
    if kind == "individual":
        names += [f"Slope: {formulation}" for formulation in formulations[1:]]
    return {
        "kind": kind,
        "formulations": formulations,
        "names": names,
        "beta": beta,
        "inverse": inverse,
        "rss": rss,
        "degrees_of_freedom": degrees_of_freedom,
        "parameter_count": parameter_count,
        "mse": rss / degrees_of_freedom,
        "r_squared": r_squared,
        "adjusted_r_squared": adjusted,
    }


def _design_row(month: float, formulation: str, formulations: list[str], kind: str) -> list[float]:
    row = [1.0, float(month)]
    if kind in {"common", "individual"}:
        row += [1.0 if formulation == value else 0.0 for value in formulations[1:]]
    if kind == "individual":
        row += [float(month) if formulation == value else 0.0 for value in formulations[1:]]
    return row


def _invert_matrix(matrix: list[list[float]]) -> list[list[float]]:
    size = len(matrix)
    augmented = [row[:] + [1.0 if i == j else 0.0 for j in range(size)] for i, row in enumerate(matrix)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise ValueError("The worksheet does not contain enough independent observations for this model.")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [value - factor * pivot_value for value, pivot_value in zip(augmented[row], augmented[column])]
    return [row[size:] for row in augmented]


def _nested_model_p_value(reduced: dict[str, Any], full: dict[str, Any]) -> float | None:
    numerator_df = full["parameter_count"] - reduced["parameter_count"]
    denominator_df = full["degrees_of_freedom"]
    if numerator_df <= 0 or denominator_df <= 0 or full["rss"] <= 0:
        return None
    statistic = max(((reduced["rss"] - full["rss"]) / numerator_df) / (full["rss"] / denominator_df), 0.0)
    p_value = 1.0 - _f_cdf(statistic, numerator_df, denominator_df)
    return min(max(p_value, 0.0), 1.0) if isfinite(p_value) else None


def _prediction_curve(
    model: dict[str, Any],
    formulation: str,
    months: list[float],
    confidence_level: float,
    has_upper_limit: bool,
    has_lower_limit: bool,
) -> list[dict[str, float]]:
    probability = (1.0 + confidence_level) / 2.0 if has_upper_limit and has_lower_limit else confidence_level
    critical_value = _t_quantile(probability, model["degrees_of_freedom"])
    points = []
    for month in months:
        row = _design_row(month, formulation, model["formulations"], model["kind"])
        predicted = sum(coefficient * value for coefficient, value in zip(model["beta"], row))
        variance_factor = sum(row[i] * model["inverse"][i][j] * row[j] for i in range(len(row)) for j in range(len(row)))
        standard_error = sqrt(max(model["mse"] * variance_factor, 0.0))
        points.append({
            "month": round(float(month), 4),
            "predicted": round(predicted, 8),
            "lower_bound": round(predicted - critical_value * standard_error, 8),
            "upper_bound": round(predicted + critical_value * standard_error, 8),
        })
    return points


def _shelf_life(
    curve: list[dict[str, float]], upper_limit: float | None, lower_limit: float | None
) -> dict[str, Any]:
    candidates: list[tuple[float, str, float]] = []
    if upper_limit is not None:
        crossing = _find_crossing(curve, "upper_bound", upper_limit, "upper")
        if crossing is not None:
            candidates.append((crossing, "Upper confidence bound", upper_limit))
    if lower_limit is not None:
        crossing = _find_crossing(curve, "lower_bound", lower_limit, "lower")
        if crossing is not None:
            candidates.append((crossing, "Lower confidence bound", lower_limit))
    if not candidates:
        return {
            "shelf_life": None,
            "limiting_bound": "Not reached",
            "specification_limit": None,
            "status": "Specification not crossed within the search range",
        }
    shelf_life, limiting_bound, specification_limit = min(candidates, key=lambda item: item[0])
    return {
        "shelf_life": round(shelf_life, 3),
        "limiting_bound": limiting_bound,
        "specification_limit": specification_limit,
        "status": "Shelf life estimated",
    }


def _find_crossing(
    curve: list[dict[str, float]], key: str, limit: float, direction: str
) -> float | None:
    for index, point in enumerate(curve):
        crossed = point[key] >= limit if direction == "upper" else point[key] <= limit
        if not crossed:
            continue
        if index == 0:
            return point["month"]
        previous = curve[index - 1]
        y1, y2 = previous[key], point[key]
        if abs(y2 - y1) < 1e-12:
            return point["month"]
        fraction = (limit - y1) / (y2 - y1)
        return max(previous["month"] + fraction * (point["month"] - previous["month"]), 0.0)
    return None


def _regularized_beta(x: float, a: float, b: float) -> float:
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    front = exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * log(x) + b * log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _beta_continued_fraction(x, a, b) / a
    return 1.0 - front * _beta_continued_fraction(1.0 - x, b, a) / b


def _beta_continued_fraction(x: float, a: float, b: float) -> float:
    tiny = 1e-30
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    result = d
    for iteration in range(1, 201):
        doubled = 2 * iteration
        coefficient = iteration * (b - iteration) * x / ((qam + doubled) * (a + doubled))
        d = 1.0 + coefficient * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + coefficient / c
        c = c if abs(c) > tiny else tiny
        result *= d * c
        coefficient = -(a + iteration) * (qab + iteration) * x / ((a + doubled) * (qap + doubled))
        d = 1.0 + coefficient * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + coefficient / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        result *= delta
        if abs(delta - 1.0) < 3e-10:
            break
    return result


def _f_cdf(value: float, numerator_df: float, denominator_df: float) -> float:
    x = numerator_df * value / (numerator_df * value + denominator_df)
    return _regularized_beta(x, numerator_df / 2.0, denominator_df / 2.0)


def _t_cdf(value: float, degrees_of_freedom: float) -> float:
    x = degrees_of_freedom / (degrees_of_freedom + value * value)
    tail = 0.5 * _regularized_beta(x, degrees_of_freedom / 2.0, 0.5)
    return 1.0 - tail if value >= 0 else tail


def _t_quantile(probability: float, degrees_of_freedom: float) -> float:
    if not 0.5 < probability < 1.0 or degrees_of_freedom <= 0:
        raise ValueError("Unable to calculate confidence bounds. Add more observations.")
    low, high = 0.0, 50.0
    for _ in range(100):
        middle = (low + high) / 2.0
        if _t_cdf(middle, degrees_of_freedom) < probability:
            low = middle
        else:
            high = middle
    return (low + high) / 2.0
