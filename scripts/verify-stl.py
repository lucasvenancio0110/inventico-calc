import sys, json, os
from pathlib import Path
if os.environ.get('INVENTICO_STL_LIBS'):
    sys.path.insert(0, os.environ['INVENTICO_STL_LIBS'])
import trimesh
results=[]
for path in Path('fixtures/generated').glob('*.stl'):
    mesh=trimesh.load_mesh(path,process=False)
    # Analysis-only welding: STL repeats vertices. No repairs or re-export.
    mesh.merge_vertices(digits_vertex=5)
    report=dict(file=path.name,watertight=bool(mesh.is_watertight),winding_consistent=bool(mesh.is_winding_consistent),volume=float(mesh.volume),bounds=mesh.bounds.tolist(),bodies=int(mesh.body_count),faces=len(mesh.faces))
    assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume>0, report
    if path.name=='frame.stl':
        assert abs(mesh.volume-3600)<.001
        section=mesh.section(plane_origin=[0,0,1.5],plane_normal=[0,0,1])
        assert section is not None and len(section.discrete)==2
    results.append(report)
Path('fixtures/generated/independent-report.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
