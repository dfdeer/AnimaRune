# 서바이벌 숲 — 편집기(https://claude.ai/artifact/9EzHxpe75dgH3sXmyHZepD)에서 「내보내기」한 설정 → 게임 데이터 (build 558~)
# 쓰는 법: 설정을 tools/sv_forest_layout.json에 붙여 넣고 `python3 tools/sv_forest_build.py`
#  → assets/survival/forest/ground.webp(바닥 마스크 R 길·G 숲 바닥·B 물)를 새로 쓰고, tools/sv_forest_data.js(const SV_FO = …)를 만듦 → index.html의 const SV_FO 줄을 이걸로 바꿈
#  → tools/sv_forest_gb.png = 판정 확인 그림(빨강 막힘 · 파랑 물 · 초록 다님) · sv_forest_layout_clean.json = 맵 밖 조각 뺀 설정(편집기 기본 배치용)
# 판정 규칙은 편집기 blkGrid · 게임 svMakeForest와 같게 유지할 것 (바위·석상·세계수·큰 버섯 원은 게임에서 따로)
import json, numpy as np, math
from PIL import Image, ImageFilter
import os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A=os.path.join(ROOT,'assets/survival/forest/')
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,'tools/sv_forest_layout.json')
OUT=os.path.join(ROOT,'tools/')
J=json.load(open(SRC))
MW,MH=2400,1350; PC=15; PN=160; BC=15; BW,BH=160,90
W0={'worldtree':560,'tree_a':130,'tree_b':130,'tree_c':125,'edge':440,'rock':170,'root_a':300,'root_b':280,'root_c':220,'shrine':80,'bridge':190,'bush':56,'reed':52,'bankstone':90,'lily':62,'flower':46,'mush':44,'fruit':40}
AR={}
def ar(t):
    if t not in AR:
        im=Image.open(A+t+'.webp'); AR[t]=im.size[1]/im.size[0]
    return AR[t]
# 1) 맵 밖 조각 정리 — 그림이 맵(0~2400 × 0~1350)에 조금도 안 걸치면 뺌
P=[]; drop=0
for p in J['pieces']:
    w=W0[p['t']]*p['s']; h=w*ar(p['t'])
    if p['x']+w/2 < 0 or p['x']-w/2 > MW or p['y']-h > MH or p['y'] < 0: drop+=1; continue
    P.append(dict(p,w=w,h=h))
print('pieces',len(J['pieces']),'->',len(P),'dropped',drop)
def unrle(s,n):
    a=np.zeros(n,np.uint8); i=0
    for t in s.split(','):
        v,c=map(int,t.split(':')); a[i:i+c]=v; i+=c
    return a
path=unrle(J['path'],PN*PN).reshape(PN,PN)[:90]   # 1350/15 = 90줄
water=unrle(J['water'],PN*PN).reshape(PN,PN)[:90]
# 2) 판정 칸(30)
gb=np.zeros((BH,BW),np.uint8); tree=np.zeros((BH,BW),bool)
for j in range(BH):
    for i in range(BW):
        if water[j,i]: gb[j,i]=2
cx=(np.arange(BW)+0.5)*BC; cy=(np.arange(BH)+0.5)*BC; X,Y=np.meshgrid(cx,cy)
def circ(x,y,r): return (X-x)**2+(Y-y)**2 < r*r
for p in P:
    t,x,y,w,h=p['t'],p['x'],p['y'],p['w'],p['h']
    if t.startswith('tree'): m=circ(x,y-0.06*h,0.3*w); gb[m]=1; tree|=m
    # 바위·석상·세계수·큰 버섯은 게임에서 원으로 정확히 (격자 안 씀)
    elif t.startswith('root') or t=='edge':  # 뿌리·숲 벽 — 그림 모양(아래쪽 band)대로 막음 (편집기와 같은 규칙)
        band=1 if t.startswith('root') else 0.62; al=np.array(Image.open(A+t+'.webp').convert('RGBA'))[...,3]; nh,nw=al.shape
        a=math.radians(p.get('r',0)); ca,sa=math.cos(a),math.sin(a); R=math.hypot(w,h)
        m=(np.abs(X-x)<R)&(np.abs(Y-y)<R); wx=X[m]-x; wy=Y[m]-y; lx=wx*ca+wy*sa; ly=-wx*sa+wy*ca
        if p.get('f'): lx=-lx
        u=((lx+w/2)/w*nw).astype(int); v=((ly+h)/h*nh).astype(int); ok=(u>=0)&(u<nw)&(v>=int(nh*(1-band)))&(v<nh)
        hit=np.zeros(ok.shape,bool); hit[ok]=al[v[ok],u[ok]]>=140; idx=np.argwhere(m); gb[idx[hit][:,0],idx[hit][:,1]]=1
# 다리: 편집기와 같은 규칙(밑동 기준으로 돌린 상판 안이면 물을 지나감)
for p in P:
    if p['t']!='bridge': continue
    a=math.radians(p.get('r',0)); ca,sa=math.cos(a),math.sin(a); w,h=p['w'],p['h']
    wx=X-p['x']; wy=Y-p['y']; lx=wx*ca+wy*sa; ly=-wx*sa+wy*ca
    m=(np.abs(lx)<w*0.38)&(ly<-h*0.12)&(ly>-h*0.78); gb[m&(gb==2)]=0
# 세계수 샘에서 갈 수 있는 곳만 남기기 (갇힌 빈칸은 막음 = 숲 속)
wt=[p for p in P if p['t']=='worldtree'][0]
sx,sy=int(wt['x']//BC),int((wt['y']-0.21*wt['w'])//BC)
seen=np.zeros_like(gb,bool); st=[(sy,sx)]; seen[sy,sx]=True
while st:
    j,i=st.pop()
    for dj,di in ((1,0),(-1,0),(0,1),(0,-1)):
        jj,ii=j+dj,i+di
        if 0<=jj<BH and 0<=ii<BW and not seen[jj,ii] and gb[jj,ii]==0: seen[jj,ii]=True; st.append((jj,ii))
lock=(gb==0)&~seen; print('free',int(seen.sum()),'locked',int(lock.sum()))
gb[lock]=1
dark=(tree|lock)&(gb!=2)
# 3) 바닥 마스크 (2단위 = 1px)
S=2; OW,OH=MW//S,MH//S
def up(a,cell):  # 칸 → 1px=2단위
    im=Image.fromarray((a*255).astype(np.uint8)).resize((a.shape[1]*cell//S,a.shape[0]*cell//S),Image.NEAREST)
    return im.crop((0,0,OW,OH))
def smooth(im,r1,r2):
    b=np.array(im.filter(ImageFilter.GaussianBlur(r1)))>127
    return Image.fromarray((b*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r2))
pa=smooth(up(path,PC),5,1.2); wa=smooth(up(water,PC),5,1.2)
da=up(dark.astype(np.uint8),BC).filter(ImageFilter.GaussianBlur(14))
Image.merge('RGB',[pa,da,wa]).save(A+'ground.webp',lossless=True,quality=100,method=6)
# 4) 게임용 데이터
def rle(a):
    a=a.ravel(); o=[]; c=a[0]; n=0
    for v in a:
        if v==c: n+=1
        else: o.append(f'{c}:{n}'); c=v; n=1
    o.append(f'{c}:{n}'); return ','.join(o)
pcs=[[p['t'],round(p['x']),round(p['y']),round(p['w']),p.get('f',0),p.get('r',0)] for p in P]
pods=[q for q in J['pods'] if gb[int(q[1]//BC),int(q[0]//BC)]==0]
print('pods',len(J['pods']),'->',len(pods))
open(OUT+'sv_forest_data.js','w').write('const SV_FO = { pcs:'+json.dumps(pcs,separators=(',',':'),ensure_ascii=False)+',\n  gb:\''+rle(gb)+'\', pods:'+json.dumps(pods,separators=(',',':'))+' };\n')
# 편집기 기본 배치용 (정리된 것)
J2=dict(J); J2['pieces']=[{k:p[k] for k in ('t','x','y','s','r','f')} for p in P]; J2['pods']=pods
open(OUT+'sv_forest_layout_clean.json','w').write(json.dumps(J2,separators=(',',':'),ensure_ascii=False))
# 확인용
v=np.zeros((BH,BW,3),np.uint8); v[gb==1]=(200,60,60); v[gb==2]=(60,90,220); v[(gb==0)]=(90,170,80)
Image.fromarray(v).resize((BW*8,BH*8),Image.NEAREST).save(OUT+'sv_forest_gb.png')
