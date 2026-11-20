"""Generate deterministic expected values independently of the TypeScript calculator.

Optional audit tooling only; see docs/CALCULATOR_ACCURACY.md for versions and usage.
Writes the JSON cases to stdout so no fixture or Python packages are shipped.
"""

import json
import math
import operator
import random
import sys
from fractions import Fraction as F
from decimal import Decimal as D, localcontext
import mpmath as mp
import numpy as np
from scipy import stats, integrate
rng=random.Random(20031118)
mp.mp.dps=75
cases=[]
def add(kind, args, wanted, rtol=2e-9, atol=2e-13):
    cases.append([kind,args,wanted,rtol,atol])
for i in range(240):
    a,b,c,d=[rng.randint(1,10000) for _ in range(4)]
    add('expression',[f'({a}/{b}+{c}/{d})*({b}/{a})^2'],float((F(a,b)+F(c,d))*(F(b,a)**2)))
for i in range(270):
    mode=rng.choice(['DEG','GRAD','RAD']); f=rng.choice(['sin','cos','tan']); x=rng.uniform(-1e7,1e7)
    if i%6==0 and mode=='RAD': x*=10**rng.randint(2,100)
    if mode=='RAD': result=getattr(math,f)(x)
    else: result=float(getattr(mp,f)(mp.mpf(str(x))*mp.pi/(180 if mode=='DEG' else 200)))
    add('trig',[f'{f}({x})',mode],result,1e-11)
for i in range(160):
    a=complex(rng.uniform(-6,6),rng.uniform(-6,6));b=complex(rng.uniform(-6,6),rng.uniform(-6,6))
    op=rng.choice(['+','-','*','/','^']); result={'+' : operator.add,'-':operator.sub,'*':operator.mul,'/':operator.truediv,'^':operator.pow}[op](a,b)
    add('complex',[f'({a.real}+({a.imag})i){op}({b.real}+({b.imag})i)'],[result.real,result.imag])
for n in range(1,5):
    for i in range(45):
        A=[[rng.randint(-8,8) for _ in range(n)] for _ in range(n)]
        det=round(np.linalg.det(np.array(A)))
        add('det',[A],det)
        if n>1 and det:
            b=[rng.randint(-15,15) for _ in range(n)]
            add('system',[A,b],np.linalg.solve(A,b).tolist())
        if det: add('inverse',[A],np.linalg.inv(A).tolist())
for i in range(120):
    u=[rng.uniform(-2,2) for _ in range(3)];v=[rng.uniform(-2,2) for _ in range(3)]
    add('vector',['angle',u,v,'RAD'],math.atan2(np.linalg.norm(np.cross(u,v)),np.dot(u,v)))
    add('vector',['cross',u,v,'RAD'],np.cross(u,v).tolist())
for degree in range(2,5):
    for i in range(80):
        roots=[]
        while len(roots)<degree:
            if len(roots)<degree-1 and rng.randrange(2):
                c=complex(rng.randrange(-8,9),rng.randrange(1,7)); roots += [c,c.conjugate()]
            else: roots.append(complex(rng.randrange(-10,11),0))
        coeff=np.poly(roots).real.round().astype(int).tolist()
        add('poly',[coeff],[[z.real,z.imag] for z in sorted(roots,key=lambda z:(z.real,z.imag))],3e-8,1e-9)
        left=rng.choice([True,False]); op='<' if left else '>'
        for j in range(3):
            x=rng.randint(-16,16)+.5
            p=1
            for z in roots: p*=complex(x)-z
            add('inequality',[coeff,op,x],p.real<0 if left else p.real>0)
for i in range(100):
    df=rng.randint(1,179);t=rng.uniform(-28,28)
    add('student',[t,df],2*stats.t.sf(abs(t),df),2e-11,0)
    x=rng.uniform(-36,36);w=10**rng.uniform(-5,0); a=x;b=x+w
    if a>=0: area=stats.norm.sf(a)-stats.norm.sf(b)
    elif b<=0: area=stats.norm.cdf(b)-stats.norm.cdf(a)
    else: area=stats.norm.cdf(b)-stats.norm.cdf(a)
    add('normal',[a,b,0,1],area,1e-8,0)
    n=rng.randint(1,10000);p=rng.uniform(.002,.998);k=max(0,min(n,round(n*p+rng.uniform(-3,3)*math.sqrt(n*p*(1-p)))))
    add('binomial',[k,n,p,True],stats.binom.cdf(k,n,p),2e-9,0)
    lam=rng.uniform(.01,9750);k=max(0,round(lam+rng.uniform(-3,3)*math.sqrt(lam)))
    add('poisson',[k,lam,True],stats.poisson.cdf(k,lam),2e-9,0)
    q=10**rng.uniform(-300,-.302);add('inverseNormal',[q,0,1],stats.norm.ppf(q),5e-11)
    data=[rng.randrange(-100,101) for _ in range(rng.randint(2,115))];conf=rng.choice([.50,.90,.95,.99,.9999]);mu=rng.randrange(-200,201)
    critical=stats.t.ppf((1+conf)/2,len(data)-1);st=(np.mean(data)-mu)/stats.sem(data)
    add('infer',[data,mu,conf],[float(st),2*stats.t.sf(abs(st),len(data)-1),float(np.mean(data)-critical*stats.sem(data)),float(np.mean(data)+critical*stats.sem(data))],2e-9)
for i in range(75):
    x=np.arange(1,13,dtype=float)+rng.randint(0,7); y=rng.uniform(1,7)+x*rng.uniform(.1,2)+np.array([rng.uniform(-.49,.49) for _ in x]); z=rng.uniform(1,18)
    k=rng.choice(['linear','quadratic','logarithmic','exponential','exponentialBase','power','inverse'])
    tx=lambda v: np.log(v) if k in ('logarithmic','power') else 1/v if k=='inverse' else v
    ty=np.log(y) if k in ('exponential','exponentialBase','power') else y
    X=np.vander(tx(x),3 if k=='quadratic' else 2,increasing=True);beta=np.linalg.lstsq(X,ty,rcond=None)[0]
    p=sum(c*tx(z)**i for i,c in enumerate(beta));r2=1-np.sum((ty-X@beta)**2)/np.sum((ty-np.mean(ty))**2)
    if k in ('exponential','exponentialBase','power'): p=math.exp(p)
    add('regression',[k,np.column_stack((x,y)).tolist(),z],[float(p),float(r2)],2e-8)
for i in range(95):
    P=rng.randint(0,50000);r=rng.uniform(0,1.2);n=rng.randint(1,600);idx=rng.randrange(n)
    with localcontext() as ctx:
        ctx.prec=80;R=D(str(r))/12;d=D(1)+R
        pay=D(P)*R/(1-d**(-n));Bal=pay*(1-d**(-(n-idx-1)))/R
        add('loan',[P,r,n,idx],[float(pay),float(pay*n-D(P)),float(Bal),float(pay)],3e-12)
        f=rng.randint(-300,200);rate=rng.uniform(-.08,.12);m=rng.randint(1,140);dr=D(str(rate));q=1+dr;begin=rng.choice([False,True]);fv=D(P)*q**m+D(f)*sum(q**k for k in range(int(begin),m+int(begin)))
        add('timeValue',['future',P,f,0,rate,m,begin],float(fv),3e-11)
        flows=[rng.randint(-7500,4900) for _ in range(rng.randrange(2,20))];expected=sum(D(v)/(q**k) for k,v in enumerate(flows));add('npv',[flows,rate],float(expected),3e-11,1e-10)
        cpn=rng.random()/5; y=rng.random()/4; freq=rng.choice([1,2,4,12]); bond=sum(D(P)*D(str(cpn))/freq/(1+D(str(y))/freq)**k for k in range(1,m+1))+D(P)/(1+D(str(y))/freq)**m
        add('bond',[P,cpn,y,freq,m],float(bond),3e-11)
for i in range(80):
    f=rng.choice([('sin(x)',math.sin),('x^3-2*x+1',lambda x:x**3-2*x+1),('exp(-x^2)',lambda x:math.exp(-x*x)),('cos(200*x)',lambda x:math.cos(200*x))]);a=rng.uniform(-1,1);b=rng.uniform(-1,1)
    add('integral',[f'integral({f[0]},{a},{b})'],integrate.quad(f[1],a,b,epsabs=1e-12)[0],1e-10,2e-11)
for i in range(60):
    start,end=sorted([rng.uniform(-1,1),rng.uniform(-1,1)]);x=rng.uniform(-5,5);s=rng.randrange(1,8)
    add('graph',[start,end,s,x],[(end**3-start**3)/3-s*(end-start),2*x],1e-8,1e-11)
    add('sequence',[s,10],[s*2**j for j in range(10)])
    add('surface',[s],[s,0,s**2])
    add('lineTable',[s],[[x,x*x+7] for x in range(s,s+5)])
json.dump(cases, sys.stdout, allow_nan=False)
sys.stdout.write("\n")
