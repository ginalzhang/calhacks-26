from pathlib import Path
import json,datetime,sys
root=Path(__file__).parent
trial=sys.argv[1] if len(sys.argv)>1 else '01'
assert len(trial)==2 and trial.isdigit()
raw=json.loads((root/f'hardware-trial-{trial}.json').read_text())
rows=raw['observations']
result={'classification':'derived numeric manual-camera observer summary; operator reports retained separately','source':f'hardware-trial-{trial}.json','startedAt':raw['startedAt'],'finishedAt':raw.get('finishedAt'),'error':raw.get('error'),'modes':{},'unsafeActiveInputRows':sum(bool(o.get('buttonDown') or o.get('microphoneEnabled') or o.get('realInput')) for o in rows)}
def time(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
for mode in ['head','palm']:
    group=[o for o in rows if o.get('mode')==mode]
    messages=[]; revisions=[]; baselines=[]; handTransitions=[]; maxBackground=0; backgroundStart=None; priorHand=None
    formats=[]
    for o in group:
        p=o.get('probe') or {};s=o.get('setup') or {};c=s.get('calibration')
        fmt={k:p.get(k) for k in ['cameraId','width','height','frameRate','delegate']}
        attributable=p.get('mode')==mode or (p.get('mode') is None and (mode=='head' or p.get('selectedHand') in ['Left','Right'] or (c and c.get('mode')=='palm')))
        if attributable and fmt.get('cameraId') and fmt not in formats:formats.append(fmt)
        message=s.get('message')
        if message and (not c or c.get('mode')==mode) and (not messages or messages[-1]['message']!=message):messages.append({'time':o['time'],'message':message,'step':s.get('step')})
        if c and c.get('mode')==mode and (not revisions or revisions[-1]['calibration']!=c):revisions.append({'time':o['time'],'calibration':c})
        if c and c.get('mode')==mode and s.get('baseline')=='complete' and not any(b['metrics']==s.get('metrics') for b in baselines):baselines.append({'time':o['time'],'metrics':s.get('metrics'),'inferenceMsP95':p.get('inferenceMsP95')})
        hand=p.get('confirmationRequired')
        if attributable and hand is not None and hand!=priorHand:handTransitions.append({'time':o['time'],'confirmationRequired':hand,'selectedHand':p.get('selectedHand'),'reason':p.get('message')});priorHand=hand
        if o.get('collapsed') and not o.get('settingsOpen') and p.get('running'):
            if backgroundStart is None:backgroundStart=o
            maxBackground=max(maxBackground,time(o['time'])-time(backgroundStart['time']))
        else:backgroundStart=None
    result['modes'][mode]={'rows':len(group),'formats':formats,'captureMessages':messages,'calibrationRevisions':revisions,'baselines':baselines,'maxObservedCollapsedSettingsClosedSeconds':maxBackground,'handConfirmationTransitions':handTransitions}
(root/f'hardware-summary-{trial}.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({mode:{'calibrationRevisions':len(v['calibrationRevisions']),'baselines':v['baselines'],'backgroundSeconds':v['maxObservedCollapsedSettingsClosedSeconds'],'handTransitions':v['handConfirmationTransitions']} for mode,v in result['modes'].items()},indent=2))
