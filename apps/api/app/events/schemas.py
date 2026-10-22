from typing import Literal
from pydantic import BaseModel, Field, model_validator
from app.events.spatial import validate_polygon

CATEGORIES=['Football','Sports','Parade','Music','Arts','Festival','Georgia Tech','Community']
class EventFilters(BaseModel):
    week: Literal['this','next']='this'
    categories: list[str]=Field(default_factory=list,max_length=20)
    geo_mode: Literal['none','radius','polygon']='none'
    center: tuple[float,float] | None=None
    radius_m: float | None=None
    polygon: dict | None=None
    cursor: int=Field(default=0,ge=0,le=100000)
    limit: int=Field(default=30,ge=1,le=100)

    @model_validator(mode='after')
    def valid(self):
        if any(c not in CATEGORIES for c in self.categories): raise ValueError('Unknown category')
        if self.geo_mode=='radius':
            if self.polygon or self.center is None or self.radius_m is None:
                raise ValueError('Choose a radius and center; clear the polygon')
            if not -180<=self.center[0]<=180 or not -90<=self.center[1]<=90:
                raise ValueError('Invalid center')
            if not 160.9344<=self.radius_m<=80467.2: raise ValueError('Choose 0.1–50 miles')
        elif self.geo_mode=='polygon':
            if self.center is not None or self.radius_m is not None or not self.polygon:
                raise ValueError('Choose a polygon without a radius')
            self.polygon=validate_polygon(self.polygon)
        elif self.center is not None or self.radius_m is not None or self.polygon:
            raise ValueError('Choose a geographic filter mode')
        return self
