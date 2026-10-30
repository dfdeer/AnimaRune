# 서바이벌 설원 — 편집기(https://claude.ai/artifact/9EzHxpe75dgH3sXmyHZepD)에서 「설정 복사」한 설정(판정 blk 포함) → 게임 데이터 (build 598~)
# 쓰는 법: 설정을 tools/sv_maps/snow.json에 붙여 넣고 `python3 tools/sv_snow_build.py`
#  → assets/survival/snow/ground.webp(바닥 마스크 R 길·G 그늘·B 얼음)를 새로 쓰고, tools/sv_snow_data.js(const SV_SN = …)를 만듦 → index.html의 const SV_SN 줄을 이걸로 바꿈
#  → tools/sv_snow_gb.png = 판정 확인 그림(빨강 막힘 · 하늘 얼음 · 초록 다님)
# 판정은 편집기가 계산해 실어 보낸 blk(15칸)를 그대로 씀 · 얼음은 지나감(미끄럽기만 — 사용자 10/30) · 온천 앞에서 못 가는 빈칸은 막음
import json, numpy as np, math, os, sys
from PIL import Image, ImageFilter
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A=os.path.join(ROOT,'assets/survival/snow/')
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,'tools/sv_maps/snow.json')
OUT=os.path.join(ROOT,'tools/')
J=json.load(open(SRC))
MW,MH=J['mw'],J['mh']; SZ=J['size']; PC=J['pc']; BC=J['bc']; PN=SZ//PC; BN=SZ//BC
BW,BH=math.ceil(MW/BC),math.ceil(MH/BC)
W0={'hotspring':520,'rim_a':440,'rim_b':330,'rim_c':260,'snowman':90,'tree_a':130,'tree_b':130,'tree_c':130,'rock':170,'bankstone':120,'bankstone2':120,'bankstone3':110,'bankstone4':120,'bridge':200,'bush':56,'crystal':50,'mound':64}
AR={}
def ar(t):
    if t not in AR:
        im=Image.open(A+t+'.webp'); AR[t]=im.size[1]/im.size[0]
    return AR[t]
# 1) 맵 밖 조각 정리 — 그림이 맵에 조금도 안 걸치면 뺌
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
path=unrle(J['path'],PN*PN).reshape(PN,PN)[:BH,:BW]
ice=unrle(J['water'],PN*PN).reshape(PN,PN)[:BH,:BW]
blk=unrle(J['blk'],BN*BN).reshape(BN,BN)[:BH,:BW]
# 2) 판정 — 1만 막힘 (2 = 얼음, 3 = 옛 편집기가 얼음을 막힘으로 쳐서 못 간다고 본 곳 → 다시 계산)
gb=(blk==1).astype(np.uint8)
cx=(np.arange(BW)+0.5)*BC; cy=(np.arange(BH)+0.5)*BC; X,Y=np.meshgrid(cx,cy)
tree=np.zeros((BH,BW),bool)
for p in P:
    if p['t'].startswith('tree'):
        x,y,w,h=p['x'],p['y'],p['w'],p['h']; tree|=((X-x)**2+(Y-(y-0.06*h))**2 < (0.3*w)**2)|(((X-x)/(0.38*w))**2+((Y-(y-0.42*h))/(0.42*h))**2<1)
# 다리 상판 = 얼음이어도 안 미끄러움 (편집기와 같은 규칙)
bridge=np.zeros((BH,BW),bool)
for p in P:
    if p['t']!='bridge': continue
    a=math.radians(p.get('r',0)); ca,sa=math.cos(a),math.sin(a); w,h=p['w'],p['h']
    wx=X-p['x']; wy=Y-p['y']; lx=wx*ca+wy*sa; ly=-wx*sa+wy*ca
    bridge|=(np.abs(lx)<w*0.38)&(ly<-h*0.12)&(ly>-h*0.78)
hs=[p for p in P if p['t']=='hotspring'][0]
sx,sy=int(hs['x']//BC),int((hs['y']+20)//BC)
assert gb[sy,sx]==0, '온천 앞이 막혀 있음'
seen=np.zeros_like(gb,bool); st=[(sy,sx)]; seen[sy,sx]=True
while st:
    j,i=st.pop()
    for dj,di in ((1,0),(-1,0),(0,1),(0,-1)):
        jj,ii=j+dj,i+di
        if 0<=jj<BH and 0<=ii<BW and not seen[jj,ii] and gb[jj,ii]==0: seen[jj,ii]=True; st.append((jj,ii))
lock=(gb==0)&~seen; print('free',int(seen.sum()),'locked',int(lock.sum()))
gb[lock]=1
icg=((ice>0)&~bridge&(gb==0)).astype(np.uint8)
dark=(tree|lock)&(ice==0)
# 3) 바닥 마스크 (2단위 = 1px)
S=2; OW,OH=MW//S,MH//S
def up(a,cell):
    im=Image.fromarray((a*255).astype(np.uint8)).resize((a.shape[1]*cell//S,a.shape[0]*cell//S),Image.NEAREST)
    return im.crop((0,0,OW,OH))
def smooth(im,r1,r2):
    b=np.array(im.filter(ImageFilter.GaussianBlur(r1)))>127
    return Image.fromarray((b*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r2))
pa=smooth(up(path,PC),5,1.2); wa=smooth(up(ice,PC),5,1.2)
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
sp=J['spawn']; assert gb[int(sp[1]//BC),int(sp[0]//BC)]==0, '시작 자리가 막혀 있음'
open(OUT+'sv_snow_data.js','w').write('const SV_SN = { mw:'+str(MW)+', mh:'+str(MH)+', spawn:'+json.dumps(sp)+', pcs:'+json.dumps(pcs,separators=(',',':'),ensure_ascii=False)+',\n  gb:\''+rle(gb)+'\',\n  ice:\''+rle(icg)+'\', pods:'+json.dumps(pods,separators=(',',':'))+' };\n')
v=np.zeros((BH,BW,3),np.uint8); v[gb==0]=(90,170,80); v[icg==1]=(150,210,240); v[gb==1]=(200,60,60)
Image.fromarray(v).resize((BW*4,BH*4),Image.NEAREST).save(OUT+'sv_snow_gb.png')
