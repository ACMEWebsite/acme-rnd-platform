"""
GI Physiology Module — Multi-compartment Gastrointestinal Tract Model.

Loads compartment parameters from data/physiology_params.yaml (stomach, duodenum, jejunum, ileum, colon).
Allows swapping fasted vs fed parameters and user overrides.
"""

from pathlib import Path
import yaml


class GIPhysiology:
    def __init__(self, yaml_path: str = None):
        if yaml_path is None:
            yaml_path = Path(__file__).resolve().parent.parent / "data" / "physiology_params.yaml"

        self.yaml_path = Path(yaml_path)
        self.params = self._load_params()
        self.compartments = list(self.params["compartments"].keys())

    def _load_params(self):
        with open(self.yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def get_compartment(self, comp_id: str):
        return self.params["compartments"][comp_id]

    def get_ph(self, comp_id: str) -> float:
        return float(self.params["compartments"][comp_id]["ph"])

    def get_volume_ml(self, comp_id: str) -> float:
        return float(self.params["compartments"][comp_id]["volume_ml"])

    def get_transit_time_hr(self, comp_id: str) -> float:
        return float(self.params["compartments"][comp_id]["transit_time_hr"])

    def get_transit_rate_1_hr(self, comp_id: str) -> float:
        tt = self.get_transit_time_hr(comp_id)
        return 1.0 / tt if tt > 0 else 0.0

    def get_surface_area_cm2(self, comp_id: str) -> float:
        return float(self.params["compartments"][comp_id]["surface_area_cm2"])

    def is_absorptive(self, comp_id: str) -> bool:
        return bool(self.params["compartments"][comp_id].get("is_absorptive", True))
