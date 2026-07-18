"""
Known Gree status/command property codes (the "opt"/"cols" keys).

Confirmed against tomikaa87/gree-remote's protocol documentation and
cross-checked against the property list used by a currently-maintained
Home Assistant custom integration (RobHofmann/HomeAssistant-GreeClimateComponent),
which has picked up a few keys added on newer firmware since the original
2018 writeup. Full detail and sources: docs/GREE_PROTOCOL.md.

Not every unit implements every key. An unsupported write is silently
ignored by the AC; an unsupported read just won't appear back in `dat`.
This is "what's worth asking for," not a promise every field exists on
this specific model — confirm against the real unit via scripts/diagnose.py.
"""

from enum import IntEnum


class Power(IntEnum):
    OFF = 0
    ON = 1


class Mode(IntEnum):
    AUTO = 0
    COOL = 1
    DRY = 2
    FAN = 3
    HEAT = 4  # only meaningful if this unit is a heat-pump variant — unconfirmed, test it


class FanSpeed(IntEnum):
    AUTO = 0
    LOW = 1
    MEDIUM_LOW = 2   # not present on 3-speed units
    MEDIUM = 3
    MEDIUM_HIGH = 4  # not present on 3-speed units
    HIGH = 5


class TempUnit(IntEnum):
    CELSIUS = 0
    FAHRENHEIT = 1


# The standard status query set — mirrors what the official app requests.
STATUS_KEYS = [
    "Pow", "Mod", "SetTem", "WdSpd", "Air", "Blo", "Health", "SwhSlp",
    "Lig", "SwingLfRig", "SwUpDn", "Quiet", "Tur", "StHt", "TemUn",
    "HeatCoolType", "TemRec", "SvSt",
]

# Seen on newer firmware in the wild. Ask for these too, but don't be
# surprised if they come back missing on an older WiFi module.
EXTENDED_STATUS_KEYS = [
    "TemSen",          # internal temperature sensor, +40 offset applied
    "SlpMod",          # newer multi-stage sleep curve
    "AntiDirectBlow",  # avoid blowing directly on occupants
    "LigSen",          # ambient light sensor -> auto display dimming
]

PROPERTY_LABELS = {
    "Pow": "Power",
    "Mod": "Mode",
    "SetTem": "Target temperature",
    "WdSpd": "Fan speed",
    "Air": "Fresh air valve",
    "Blo": "X-Fan (blow-dry after shutoff)",
    "Health": "Health / cold plasma",
    "SwhSlp": "Sleep mode",
    "Lig": "Display light",
    "SwingLfRig": "Horizontal swing",
    "SwUpDn": "Vertical swing",
    "Quiet": "Quiet mode",
    "Tur": "Turbo",
    "StHt": "8°C frost-protection heating",
    "TemUn": "Temperature unit (0=C, 1=F)",
    "TemRec": "Fahrenheit half-degree bit",
    "SvSt": "Power saving",
    "TemSen": "Internal sensor temperature",
    "SlpMod": "Sleep curve mode",
    "AntiDirectBlow": "Avoid direct airflow",
    "LigSen": "Light-sensor auto display dimming",
}


def decode_sensor_temp(raw: int) -> int:
    """TemSen carries a +40 offset so the device never has to send a
    negative byte. raw=65 -> 25 degrees C."""
    return raw - 40


def celsius_to_fahrenheit_fields(desired_f: float) -> dict:
    """Some firmwares need TemRec to disambiguate which Celsius step a
    Fahrenheit target rounds to. See docs/GREE_PROTOCOL.md section 4.
    Prefer set_temperature_celsius() in device.py where possible — this
    exists for the cases where Fahrenheit is genuinely required.

    NOTE — flagged during verification, not silently fixed: the source
    worked example table (tomikaa87/gree-remote README) matches this
    formula for every row except 77F/25.0C, where the table lists TemRec=1
    but this formula computes 0 (exact Celsius lands exactly on the
    integer boundary, so the ">0" check is false). That's either a minor
    error in the source table or a real device quirk at exact boundary
    values that the stated formula doesn't capture — I can't tell which
    without testing a real unit. Don't trust this function at exact whole-
    Celsius Fahrenheit boundaries until it's been checked against the
    actual AC; it's untested for those edge values either way.
    """
    set_tem = round((desired_f - 32.0) * 5.0 / 9.0)
    exact = (desired_f - 32.0) * 5.0 / 9.0
    tem_rec = 1 if (exact - set_tem) > 0 else 0
    return {"TemUn": TempUnit.FAHRENHEIT, "SetTem": set_tem, "TemRec": tem_rec}
