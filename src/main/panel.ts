import type { DisplayInfo } from '../shared/contracts';
export function preferredDisplay(displays:DisplayInfo[],selected?:number):DisplayInfo|undefined {
  return displays.find(display=>display.id===selected)??displays.find(display=>display.builtIn)??displays.find(display=>display.primary)??displays[0];
}
export function panelPosition(display:DisplayInfo):{x:number;y:number} {
  return {x:display.workArea.x+display.workArea.width-320-16,y:display.workArea.y+16};
}
