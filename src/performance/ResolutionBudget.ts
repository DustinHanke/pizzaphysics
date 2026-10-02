/** Slow, bounded resolution changes; simulation always retains its fixed timestep. */
export class ResolutionBudget {
 ratio:number;private slow=0;private fast=0;private elapsed=0;
 constructor(readonly maximum:number,readonly minimum=Math.min(1,maximum)){this.ratio=maximum;}
 update(seconds:number){
  if(seconds<=0||seconds>.2)return false;
  this.elapsed+=seconds;this.slow+=seconds>.022?seconds:0;this.fast+=seconds<.018?seconds:0;
  if(this.elapsed<2)return false;
  const old=this.ratio;
  if(this.slow>this.elapsed*.65)this.ratio=Math.max(this.minimum,this.ratio-.15);
  else if(this.fast>this.elapsed*.95)this.ratio=Math.min(this.maximum,this.ratio+.05);
  this.elapsed=this.slow=this.fast=0;return Math.abs(old-this.ratio)>.001;
 }
}
