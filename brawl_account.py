from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class GadgetList(BaseModel):
    gadget1: Optional[str] = None
    gadget2: Optional[str] = None

class StarPowerList(BaseModel):
    star_power1: Optional[str] = None
    star_power2: Optional[str] = None

class HyperchargeList(BaseModel):
    hypercharge: Optional[str] = None

class BuffieList(BaseModel):
    gadget_buffie: bool = False
    star_power_buffie: bool = False
    hypercharge_buffie: bool = False

class GearList(BaseModel):
    speed_gear: bool = False
    health_gear: bool = False
    force_gear: bool = False
    vision_gear: bool = False
    shield_gear: bool = False
    cooldown_gear: bool = False
    others: Optional[list[str]] = None

class Brawler(BaseModel):
    """Individual brawler information"""
    name: str
    power: int = Field(ge=1, le=11)
    trophies: int = Field(ge=0)
    highest_trophies: int = Field(ge=0)
    gadgets: GadgetList
    star_powers: StarPowerList
    hypercharges: HyperchargeList
    buffies: BuffieList
    gears: GearList

    @property
    def prestige(self) -> int:
        """Calculate the prestige level of the brawler based on its trophies"""
        return self.trophies // 1000

class BrawlAccount(BaseModel):
    """Brawl Stars account information"""
    tag: str
    name: str
    trophies: int = Field(ge=0)
    highest_trophies: int = Field(ge=0)

    win_solo: int = Field(ge=0)
    win_duo: int = Field(ge=0)
    win_3v3: int = Field(ge=0)

    club_tag: Optional[str] = None
    club_name: Optional[str] = None

    brawlers: list[Brawler] = []

    @property
    def total_victories(self) -> int:
        """Total wins across all modes"""
        return self.win_3v3 + self.win_solo + self.win_duo

    @property
    def brawler_count(self) -> int:
        """Number of brawlers unlocked"""
        return len(self.brawlers)

    @property
    def total_prestiges(self) -> int:
        """Total prestige levels across all brawlers"""
        return sum(brawler.prestige for brawler in self.brawlers)