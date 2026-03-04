import React, { useState, useEffect, useRef, useCallback } from "react";
import { Golfers, Courses } from "./api";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine
} from "recharts";

// NOTE FOR DEPLOYMENT: See DEPLOYMENT.md for Supabase + GitHub Actions setup guide.

/* ─── STYLES ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --forest:#1B4332;--forest-mid:#2D6A4F;--forest-pale:#40916C;--forest-light:#74C69D;
  --gold:#C8A94F;--gold-light:#DCBB6A;--gold-pale:#F5E6BB;
  --cream:#FAF8F3;--cream-2:#F0EBE0;--parchment:#E2D9C8;
  --text:#1C1917;--muted:#78716C;--white:#fff;
  --red:#DC2626;--green:#16A34A;--blue:#2563EB;
  --sh:0 4px 24px rgba(27,67,50,.07),0 1px 4px rgba(27,67,50,.04);
  --sh-md:0 8px 32px rgba(27,67,50,.10),0 2px 8px rgba(27,67,50,.05);
  --sh-lg:0 16px 48px rgba(27,67,50,.13),0 4px 12px rgba(27,67,50,.05);
  --r:16px;--r-sm:10px;
}
html,body{background:var(--cream);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--cream-2)}
::-webkit-scrollbar-thumb{background:var(--parchment);border-radius:3px}

/* NAV */
.nav{background:var(--forest);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:300;box-shadow:0 2px 20px rgba(0,0,0,.2)}
.logo{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:var(--gold);cursor:pointer;letter-spacing:.2px}
.logo em{color:#fff;font-style:normal}
.nav-links{display:flex;gap:2px}
.ntab{padding:6px 13px;border-radius:7px;border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:rgba(255,255,255,.5);cursor:pointer;transition:all .16s}
.ntab:hover{color:#fff;background:rgba(255,255,255,.08)}
.ntab.on{color:var(--gold);background:rgba(200,169,79,.14)}
.nav-user{display:flex;align-items:center;gap:8px;padding:5px 12px;background:rgba(255,255,255,.08);border-radius:20px;cursor:pointer;border:1px solid rgba(255,255,255,.1)}
.nav-user span{font-size:12px;font-weight:600;color:rgba(255,255,255,.7)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--red);display:inline-block;margin-right:5px;animation:blink 1.4s ease infinite;flex-shrink:0}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

/* CARDS */
.card{background:#fff;border-radius:var(--r);box-shadow:var(--sh);border:1px solid rgba(27,67,50,.055);padding:24px}
.card-sm{border-radius:var(--r-sm);padding:16px}

/* TYPOGRAPHY */
.h1{font-family:'Cormorant Garamond',serif;font-size:44px;font-weight:600;color:var(--forest);line-height:1.1}
.h2{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--forest)}
.h3{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:var(--forest)}
.h4{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:var(--forest)}
.label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:var(--forest-mid);margin-bottom:7px}
.sub{font-size:14px;color:var(--muted);line-height:1.55}

/* FORM */
.inp{width:100%;padding:10px 13px;border-radius:9px;border:1.5px solid var(--parchment);background:var(--cream);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);outline:none;transition:all .18s}
.inp:focus{border-color:var(--forest-pale);background:#fff;box-shadow:0 0 0 3px rgba(64,145,108,.1)}
select.inp{cursor:pointer}
.fgrp{margin-bottom:16px}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:9px;border:none;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .18s;letter-spacing:.1px;white-space:nowrap}
.btn-prim{background:var(--forest);color:#fff}.btn-prim:hover{background:var(--forest-mid);transform:translateY(-1px);box-shadow:var(--sh)}
.btn-gold{background:var(--gold);color:#fff}.btn-gold:hover{background:var(--gold-light);transform:translateY(-1px)}
.btn-out{background:transparent;color:var(--forest);border:1.5px solid var(--forest)}.btn-out:hover{background:var(--forest);color:#fff}
.btn-ghost{background:rgba(27,67,50,.07);color:var(--forest)}.btn-ghost:hover{background:rgba(27,67,50,.13)}
.btn-sm{padding:6px 13px;font-size:12px;border-radius:7px}
.btn-danger{background:#FEE2E2;color:var(--red)}.btn-danger:hover{background:var(--red);color:#fff}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
.btn-link{background:transparent;border:none;color:var(--forest-mid);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
.btn-ready{background:linear-gradient(135deg,var(--forest),var(--forest-pale));color:#fff;border:none;padding:9px 20px;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
.btn-ready:hover{transform:translateY(-1px);box-shadow:var(--sh-md)}
.btn-ready.ready-done{background:linear-gradient(135deg,var(--green),#15803d);cursor:default}

/* BADGE */
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}
.bg-forest{background:rgba(27,67,50,.1);color:var(--forest)}
.bg-gold{background:var(--gold-pale);color:#7A5C00}
.bg-red{background:#FEE2E2;color:var(--red)}
.bg-green{background:#DCFCE7;color:var(--green)}
.bg-blue{background:#DBEAFE;color:var(--blue)}
.bg-gray{background:var(--cream-2);color:var(--muted)}

/* GRID */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px}
.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px}

/* PAGE */
.page{padding:32px 28px;max-width:1240px;margin:0 auto}
.page-wide{padding:28px 24px;max-width:1500px;margin:0 auto}

/* HERO */
.hero{background:linear-gradient(148deg,#0A2018 0%,var(--forest) 55%,#183828 100%);padding:80px 40px;position:relative;overflow:hidden;text-align:center}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 70%,rgba(200,169,79,.09) 0%,transparent 50%),radial-gradient(ellipse at 80% 25%,rgba(64,145,108,.1) 0%,transparent 50%)}
.hero::after{content:'⛳';position:absolute;right:7%;top:50%;transform:translateY(-50%);font-size:180px;opacity:.045;pointer-events:none}
.hero-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;background:rgba(200,169,79,.14);border:1px solid rgba(200,169,79,.28);color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px}
.hero-title{font-family:'Cormorant Garamond',serif;font-size:60px;font-weight:700;color:#fff;line-height:1.06;margin-bottom:16px}
.hero-title span{color:var(--gold)}
.hero-sub{font-size:16px;color:rgba(255,255,255,.62);max-width:540px;margin:0 auto 36px;line-height:1.65}

/* POOL CARD */
.pool-card{background:#fff;border-radius:18px;border:1.5px solid var(--parchment);padding:22px;cursor:pointer;transition:all .22s;position:relative;overflow:hidden}
.pool-card:hover{transform:translateY(-3px);box-shadow:var(--sh-md);border-color:var(--forest-pale)}
.pool-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--forest-pale),var(--gold))}
.pool-card.live::before{background:linear-gradient(90deg,var(--red),#F97316)}
.pool-card.complete::before{background:linear-gradient(90deg,var(--gold),var(--gold-light))}

/* TABS */
.tabs{display:flex;gap:2px;background:var(--cream-2);border-radius:9px;padding:3px;margin-bottom:22px}
.tab{padding:7px 14px;border-radius:7px;border:none;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .16s;color:var(--muted);background:transparent;flex:1;text-align:center}
.tab.on{background:#fff;color:var(--forest);font-weight:700;box-shadow:0 1px 5px rgba(0,0,0,.07)}

/* PROGRESS */
.prog-bar{height:5px;border-radius:3px;background:var(--cream-2);overflow:hidden}
.prog-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--forest-pale),var(--forest-mid));transition:width .4s ease}

/* DRAFT ROOM */
.draft-layout{display:grid;grid-template-columns:240px 1fr 270px;gap:16px;height:calc(100vh - 110px);min-height:600px}
.draft-panel{background:#fff;border-radius:14px;border:1px solid rgba(27,67,50,.08);overflow:hidden;display:flex;flex-direction:column}
.panel-hdr{padding:14px 16px;border-bottom:1px solid var(--cream-2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}

/* SHOT CLOCK */
.clock-wrap{background:var(--forest);padding:18px;display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0}

/* PICK ROW */
.pick-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--cream);border:1px solid var(--parchment);margin-bottom:6px;cursor:pointer;transition:all .16s}
.pick-row:hover:not(.drafted){background:#fff;box-shadow:var(--sh);border-color:var(--forest-pale);transform:translateX(2px)}
.pick-row.drafted{opacity:.32;cursor:default;pointer-events:none}
.pick-row.highlight{background:rgba(27,67,50,.07);border-color:var(--forest-mid)}

/* LEADERBOARD */
.lb-row{display:grid;align-items:center;padding:10px 16px;border-bottom:1px solid var(--cream-2);font-size:13px;transition:background .12s;gap:8px}
.lb-row:hover{background:var(--cream)}
.lb-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);background:var(--cream-2)}

/* STAT PILL */
.stat-pill{background:var(--cream);border-radius:8px;padding:10px 14px;text-align:center}
.stat-pill-n{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;color:var(--forest);line-height:1}
.stat-pill-l{font-size:11px;color:var(--muted);margin-top:2px}

/* LINK BOX */
.link-box{background:var(--cream);border:1.5px solid var(--parchment);border-radius:9px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.link-txt{font-size:12px;color:var(--forest-mid);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* PARTICIPANT PORTAL / INVITE */
.portal-wrap{min-height:100vh;background:linear-gradient(160deg,#0D2B1D,var(--forest) 60%,#1A3D2B);display:flex;align-items:center;justify-content:center;padding:40px 20px}
.portal-card{background:#fff;border-radius:24px;padding:40px;max-width:520px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,.3)}

/* INVITE AUTH TABS */
.auth-tabs{display:flex;border-bottom:2px solid var(--cream-2);margin-bottom:24px;gap:0}
.auth-tab{flex:1;padding:10px;background:transparent;border:none;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .18s;border-bottom:2px solid transparent;margin-bottom:-2px}
.auth-tab.on{color:var(--forest);border-bottom-color:var(--forest)}

/* ORDER ROW */
.order-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;transition:all .14s;margin-bottom:3px}
.order-row.cur{background:rgba(200,169,79,.13);border-left:3px solid var(--gold)}
.order-row.done{opacity:.4}

/* SCORE COLORS */
.under{color:var(--red);font-weight:700}
.over{color:var(--muted)}
.even{color:var(--muted);font-weight:600}
.eagle{color:#7C3AED;font-weight:800}

/* TOOLTIP */
.ctt{background:#fff;border:1px solid var(--parchment);border-radius:10px;padding:10px 14px;box-shadow:var(--sh);font-size:12px}

/* POOL VIEW PHASES */
.phase-banner{background:linear-gradient(135deg,var(--forest),var(--forest-pale));padding:28px 32px;border-radius:18px;color:#fff;margin-bottom:24px;position:relative;overflow:hidden}
.phase-banner::after{content:'🏌️';position:absolute;right:24px;top:50%;transform:translateY(-50%);font-size:60px;opacity:.2}
.ready-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.ready-card{background:#fff;border-radius:12px;border:2px solid var(--parchment);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:all .2s}
.ready-card.is-ready{border-color:var(--green);background:#f0fdf4}
.update-bar{background:rgba(27,67,50,.07);border-radius:8px;padding:7px 14px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);margin-bottom:16px}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.4s ease infinite;flex-shrink:0}

/* TOURNAMENT INFO SECTION */
.tourney-expand{border:1.5px solid var(--parchment);border-radius:12px;overflow:hidden;margin-bottom:18px}
.tourney-expand-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--cream);cursor:pointer;transition:background .15s}
.tourney-expand-hdr:hover{background:var(--cream-2)}
.tourney-expand-body{padding:20px;border-top:1.5px solid var(--parchment)}

@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp .3s ease both}
@keyframes pulse-gold{0%,100%{box-shadow:0 0 0 0 rgba(200,169,79,.4)}70%{box-shadow:0 0 0 10px rgba(200,169,79,0)}}
.pulse-gold{animation:pulse-gold 2s infinite}
@keyframes slideR{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.slide-r{animation:slideR .2s ease both}

/* SEARCH */
.search-wrap{position:relative;margin-bottom:10px}
.search-wrap svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none}
.search-inp{padding-left:34px!important}
`;

/* ─── DATA ─── */
const mk = (id,name,co,rank,avg,cut,sg,dd,da,gir,putts) =>
  ({id,name,country:co,rank,avg,cut,sg,drivDist:dd,drivAcc:da,gir,putts});

const FULL_FIELD = [
  mk(1,"Scottie Scheffler","🇺🇸",1,68.1,87,4.24,314,62,74,28.1),
  mk(2,"Rory McIlroy","🇬🇧",2,68.4,84,3.85,320,58,72,27.8),
  mk(3,"Xander Schauffele","🇺🇸",3,68.7,81,3.42,303,67,73,28.0),
  mk(4,"Collin Morikawa","🇺🇸",4,68.9,79,3.10,299,68,76,28.5),
  mk(5,"Viktor Hovland","🇳🇴",5,69.1,76,2.88,312,61,71,28.3),
  mk(6,"Jon Rahm","🇪🇸",6,69.2,75,2.74,315,64,72,28.7),
  mk(7,"Patrick Cantlay","🇺🇸",7,69.3,73,2.55,298,66,74,27.6),
  mk(8,"Wyndham Clark","🇺🇸",8,69.5,72,2.40,316,60,70,28.2),
  mk(9,"Max Homa","🇺🇸",9,69.6,71,2.28,308,63,71,28.4),
  mk(10,"Brian Harman","🇺🇸",10,69.7,70,2.15,290,69,73,27.9),
  mk(11,"Justin Thomas","🇺🇸",11,69.8,69,2.05,305,65,72,28.6),
  mk(12,"Jordan Spieth","🇺🇸",12,69.9,68,1.92,297,64,70,27.4),
  mk(13,"Tony Finau","🇺🇸",13,70.0,67,1.80,318,60,69,28.8),
  mk(14,"Shane Lowry","🇮🇪",14,70.1,66,1.72,296,67,72,28.5),
  mk(15,"Tommy Fleetwood","🇬🇧",15,70.2,65,1.62,304,65,71,28.3),
  mk(16,"Hideki Matsuyama","🇯🇵",16,70.3,64,1.55,311,62,70,28.9),
  mk(17,"Sahith Theegala","🇺🇸",17,70.4,63,1.44,319,59,69,28.7),
  mk(18,"Russell Henley","🇺🇸",18,70.5,62,1.36,295,68,72,28.2),
  mk(19,"Chris Kirk","🇺🇸",19,70.6,61,1.28,294,67,71,28.1),
  mk(20,"Nick Taylor","🇨🇦",20,70.7,60,1.20,310,63,70,28.6),
  mk(21,"Keegan Bradley","🇺🇸",21,70.8,59,1.12,302,66,71,28.4),
  mk(22,"Sepp Straka","🇦🇹",22,70.9,58,1.05,308,64,70,28.8),
  mk(23,"Adam Scott","🇦🇺",23,71.0,57,0.98,305,65,71,28.5),
  mk(24,"Matt Fitzpatrick","🇬🇧",24,71.1,56,0.90,293,69,73,28.0),
  mk(25,"Sungjae Im","🇰🇷",25,71.1,55,0.84,307,64,70,28.3),
  mk(26,"Cameron Young","🇺🇸",26,71.2,55,0.78,322,58,68,28.9),
  mk(27,"Corey Conners","🇨🇦",27,71.2,54,0.73,302,68,73,28.7),
  mk(28,"Tom Kim","🇰🇷",28,71.3,53,0.68,309,63,70,28.5),
  mk(29,"Davis Riley","🇺🇸",29,71.3,52,0.62,314,61,69,28.6),
  mk(30,"Eric Cole","🇺🇸",30,71.4,52,0.57,306,65,70,28.4),
  mk(31,"Min Woo Lee","🇦🇺",31,71.4,51,0.52,318,60,69,28.8),
  mk(32,"Kurt Kitayama","🇺🇸",32,71.5,51,0.48,301,67,71,28.3),
  mk(33,"Lucas Glover","🇺🇸",33,71.5,50,0.44,295,68,72,28.1),
  mk(34,"Denny McCarthy","🇺🇸",34,71.6,49,0.40,292,69,72,27.6),
  mk(35,"Si Woo Kim","🇰🇷",35,71.6,49,0.36,307,63,70,28.5),
  mk(36,"Jason Day","🇦🇺",36,71.7,48,0.33,300,66,71,28.2),
  mk(37,"Patrick Reed","🇺🇸",37,71.7,48,0.29,298,66,70,28.4),
  mk(38,"Brendon Todd","🇺🇸",38,71.8,47,0.25,290,70,72,28.0),
  mk(39,"Bud Cauley","🇺🇸",39,71.8,46,0.22,303,65,70,28.5),
  mk(40,"Rickie Fowler","🇺🇸",40,71.9,46,0.19,308,63,69,28.7),
  mk(41,"Gary Woodland","🇺🇸",41,71.9,45,0.15,316,60,68,28.9),
  mk(42,"Adam Hadwin","🇨🇦",42,72.0,45,0.12,299,67,71,28.3),
  mk(43,"Mark Hubbard","🇺🇸",43,72.0,44,0.09,296,67,70,28.2),
  mk(44,"Keith Mitchell","🇺🇸",44,72.1,44,0.05,317,59,68,29.0),
  mk(45,"Aaron Rai","🏴󠁧󠁢󠁳󠁣󠁴󠁿",45,72.1,43,0.02,297,68,71,28.4),
  mk(46,"Joel Dahmen","🇺🇸",46,72.2,43,-0.02,294,68,70,28.2),
  mk(47,"Harris English","🇺🇸",47,72.2,42,-0.06,311,62,69,28.7),
  mk(48,"Byeong Hun An","🇰🇷",48,72.3,42,-0.10,303,64,70,28.5),
  mk(49,"Harry Hall","🏴󠁧󠁢󠁥󠁮󠁧󠁿",49,72.3,41,-0.14,300,66,70,28.3),
  mk(50,"Chez Reavie","🇺🇸",50,72.4,41,-0.18,289,71,72,28.0),
  mk(51,"Emiliano Grillo","🇦🇷",51,72.4,40,-0.22,308,63,69,28.6),
  mk(52,"Nick Dunlap","🇺🇸",52,72.5,40,-0.26,313,61,68,28.8),
  mk(53,"Ludvig Åberg","🇸🇪",53,72.5,39,-0.30,318,59,69,28.9),
  mk(54,"Doug Ghim","🇺🇸",54,72.6,38,-0.34,304,65,70,28.4),
  mk(55,"Taylor Pendrith","🇨🇦",55,72.6,38,-0.38,322,57,68,29.1),
  mk(56,"Mackenzie Hughes","🇨🇦",56,72.7,37,-0.42,296,67,70,28.3),
  mk(57,"Ben Taylor","🏴󠁧󠁢󠁥󠁮󠁧󠁿",57,72.7,37,-0.46,292,69,71,28.1),
  mk(58,"Sam Burns","🇺🇸",58,72.8,36,-0.50,305,64,69,28.5),
  mk(59,"Christiaan Bezuidenhout","🇿🇦",59,72.8,35,-0.54,301,66,70,28.4),
  mk(60,"Webb Simpson","🇺🇸",60,72.9,35,-0.58,291,70,72,27.9),
  mk(61,"Kevin Yu","🇹🇼",61,72.9,34,-0.62,307,63,69,28.6),
  mk(62,"Luke List","🇺🇸",62,73.0,33,-0.66,315,60,67,28.9),
  mk(63,"Stephan Jaeger","🇩🇪",63,73.0,33,-0.70,298,67,70,28.3),
  mk(64,"Peter Malnati","🇺🇸",64,73.1,32,-0.74,290,70,71,28.0),
  mk(65,"Taylor Moore","🇺🇸",65,73.1,32,-0.78,299,66,69,28.4),
  mk(66,"Alex Smalley","🇺🇸",66,73.2,31,-0.82,313,61,68,28.7),
  mk(67,"Callum Tarren","🏴󠁧󠁢󠁥󠁮󠁧󠁿",67,73.2,30,-0.86,295,68,70,28.2),
  mk(68,"Matthias Schwab","🇦🇹",68,73.3,30,-0.90,296,68,70,28.3),
  mk(69,"Nick Hardy","🇺🇸",69,73.3,29,-0.94,309,62,68,28.6),
  mk(70,"Ryan Gerard","🇺🇸",70,73.4,29,-0.98,302,65,69,28.4),
  mk(71,"Andrew Novak","🇺🇸",71,73.4,28,-1.02,293,69,70,28.1),
  mk(72,"Zac Blair","🇺🇸",72,73.5,28,-1.06,291,70,71,28.0),
  mk(73,"Charley Hoffman","🇺🇸",73,73.5,27,-1.10,303,64,68,28.5),
  mk(74,"James Hahn","🇺🇸",74,73.6,26,-1.14,297,67,69,28.3),
  mk(75,"Danny Lee","🇳🇿",75,73.6,26,-1.18,299,66,69,28.4),
  mk(76,"Michael Kim","🇺🇸",76,73.7,25,-1.22,291,70,70,28.1),
  mk(77,"Joseph Bramlett","🇺🇸",77,73.7,25,-1.26,305,63,68,28.6),
  mk(78,"S.H. Kim","🇰🇷",78,73.8,24,-1.30,307,63,68,28.7),
  mk(79,"J.T. Poston","🇺🇸",79,73.8,24,-1.34,294,68,70,28.2),
  mk(80,"Patton Kizzire","🇺🇸",80,73.9,23,-1.38,292,70,70,28.0),
];

const TOURNAMENTS = [
  {id:"t1",name:"THE PLAYERS Championship",venue:"TPC Sawgrass",date:"Mar 12–15, 2026",purse:"$25.0M",field:144},
  {id:"t2",name:"Valspar Championship",venue:"Innisbrook Resort",date:"Mar 19–22, 2026",purse:"$8.4M",field:132},
  {id:"t3",name:"Texas Children's Houston Open",venue:"Memorial Park GC",date:"Mar 26–29, 2026",purse:"$9.2M",field:132},
  {id:"t4",name:"Masters Tournament",venue:"Augusta National GC",date:"Apr 9–12, 2026",purse:"$20.0M",field:88},
  {id:"t5",name:"RBC Heritage",venue:"Harbour Town GL",date:"Apr 16–19, 2026",purse:"$20.0M",field:132},
  {id:"t6",name:"Zurich Classic of New Orleans",venue:"TPC Louisiana",date:"Apr 23–26, 2026",purse:"$8.9M",field:80},
  {id:"t7",name:"Wells Fargo Championship",venue:"Quail Hollow Club",date:"Apr 30–May 3",purse:"$20.0M",field:132},
  {id:"t8",name:"PGA Championship",venue:"Valhalla Golf Club",date:"May 14–17, 2026",purse:"$19.0M",field:156},
  {id:"t9",name:"Charles Schwab Challenge",venue:"Colonial CC",date:"May 21–24, 2026",purse:"$9.5M",field:132},
  {id:"t10",name:"Memorial Tournament",venue:"Muirfield Village GC",date:"May 28–31, 2026",purse:"$20.0M",field:120},
  {id:"t11",name:"U.S. Open",venue:"Shinnecock Hills GC",date:"Jun 18–21, 2026",purse:"$21.5M",field:156},
  {id:"t12",name:"Travelers Championship",venue:"TPC River Highlands",date:"Jun 25–28, 2026",purse:"$9.2M",field:156},
  {id:"t13",name:"Rocket Classic",venue:"Detroit GC",date:"Jul 2–5, 2026",purse:"$8.7M",field:132},
  {id:"t14",name:"John Deere Classic",venue:"TPC Deere Run",date:"Jul 9–12, 2026",purse:"$8.3M",field:132},
  {id:"t15",name:"The Open Championship",venue:"Royal Portrush GC",date:"Jul 16–19, 2026",purse:"$17.0M",field:156},
  {id:"t16",name:"3M Open",venue:"TPC Twin Cities",date:"Jul 23–26, 2026",purse:"$8.4M",field:132},
  {id:"t17",name:"Wyndham Championship",venue:"Sedgefield CC",date:"Aug 13–16, 2026",purse:"$7.9M",field:156},
  {id:"t18",name:"FedEx St. Jude Championship",venue:"TPC Southwind",date:"Aug 20–23, 2026",purse:"$20.0M",field:70},
  {id:"t19",name:"BMW Championship",venue:"Aronimink GC",date:"Aug 27–30, 2026",purse:"$20.0M",field:50},
  {id:"t20",name:"TOUR Championship",venue:"East Lake GC",date:"Sep 3–6, 2026",purse:"$100.0M",field:30},
];

const PARTICIPANTS_SEED = [
  {id:1,name:"James Hartwell",avatar:"JH",email:"james@example.com",token:"inv_jh_abc"},
  {id:2,name:"Sarah Chen",      avatar:"SC",email:"sarah@example.com",token:"inv_sc_def"},
  {id:3,name:"Mike Torres",     avatar:"MT",email:"mike@example.com",token:"inv_mt_ghi"},
  {id:4,name:"Emma Walsh",      avatar:"EW",email:"emma@example.com",token:"inv_ew_jkl"},
  {id:5,name:"David Park",      avatar:"DP",email:"david@example.com",token:"inv_dp_mno"},
  {id:6,name:"Lisa Monroe",     avatar:"LM",email:"lisa@example.com",token:"inv_lm_pqr"},
  {id:7,name:"Tom Bradley",     avatar:"TB",email:"tom@example.com",token:"inv_tb_stu"},
  {id:8,name:"Nina Patel",      avatar:"NP",email:"nina@example.com",token:"inv_np_vwx"},
];

// Live scores — full 80-player field with round-by-round data
const BASE_LIVE_SCORES = [
  {gId:1, R1:-7,R2:-5,R3:-4,R4:-3, pos:1,  birdies:[8,6,7,5],eagles:[0,0,1,0],bogeys:[2,2,1,1]},
  {gId:2, R1:-5,R2:-6,R3:-3,R4:-4, pos:2,  birdies:[6,7,5,6],eagles:[0,0,0,0],bogeys:[2,1,2,1]},
  {gId:3, R1:-4,R2:-4,R3:-5,R4:-3, pos:3,  birdies:[5,6,6,5],eagles:[0,0,0,0],bogeys:[2,3,1,2]},
  {gId:4, R1:-3,R2:-5,R3:-4,R4:-2, pos:4,  birdies:[5,6,5,4],eagles:[0,0,0,0],bogeys:[3,1,2,2]},
  {gId:5, R1:-4,R2:-3,R3:-4,R4:-2, pos:5,  birdies:[5,5,5,4],eagles:[0,0,0,0],bogeys:[2,3,2,3]},
  {gId:6, R1:-2,R2:-4,R3:-3,R4:-4, pos:6,  birdies:[4,5,5,5],eagles:[0,0,0,1],bogeys:[3,2,3,1]},
  {gId:7, R1:-3,R2:-3,R3:-3,R4:-3, pos:7,  birdies:[4,4,5,4],eagles:[0,0,0,0],bogeys:[2,2,3,2]},
  {gId:8, R1:-2,R2:-3,R3:-4,R4:-2, pos:8,  birdies:[4,4,5,4],eagles:[0,0,0,0],bogeys:[3,2,2,3]},
  {gId:9, R1:-1,R2:-3,R3:-2,R4:-3, pos:9,  birdies:[3,4,4,4],eagles:[0,0,0,0],bogeys:[3,2,3,2]},
  {gId:10,R1:-2,R2:-2,R3:-3,R4:-2, pos:10, birdies:[4,3,4,4],eagles:[0,0,0,0],bogeys:[3,3,2,3]},
  {gId:11,R1:1, R2:-2,R3:-3,R4:-2, pos:11, birdies:[3,3,4,4],eagles:[0,0,0,0],bogeys:[4,3,2,3]},
  {gId:12,R1:-1,R2:-1,R3:-2,R4:-2, pos:12, birdies:[3,3,3,4],eagles:[0,0,0,0],bogeys:[3,3,3,3]},
  {gId:13,R1:-1,R2:-2,R3:-1,R4:-1, pos:13, birdies:[3,4,3,3],eagles:[0,0,0,0],bogeys:[3,3,3,3]},
  {gId:14,R1:-2,R2:-1,R3:-1,R4:0,  pos:14, birdies:[3,3,3,2],eagles:[0,0,0,0],bogeys:[2,3,3,3]},
  {gId:15,R1:0, R2:-2,R3:-1,R4:-1, pos:15, birdies:[2,4,3,3],eagles:[0,0,0,0],bogeys:[3,3,4,4]},
  {gId:16,R1:-1,R2:-1,R3:-1,R4:0,  pos:16, birdies:[3,3,3,2],eagles:[0,0,0,0],bogeys:[3,3,3,3]},
  {gId:17,R1:0, R2:-1,R3:-1,R4:-1, pos:17, birdies:[2,3,3,3],eagles:[0,0,0,0],bogeys:[3,4,4,4]},
  {gId:18,R1:-1,R2:0, R3:-1,R4:0,  pos:18, birdies:[3,2,3,2],eagles:[0,0,0,0],bogeys:[3,3,4,3]},
  {gId:19,R1:0, R2:-1,R3:0, R4:-1, pos:19, birdies:[2,3,2,3],eagles:[0,0,0,0],bogeys:[3,4,3,4]},
  {gId:20,R1:0, R2:0, R3:-1,R4:0,  pos:20, birdies:[2,2,3,2],eagles:[0,0,0,0],bogeys:[3,3,4,3]},
  {gId:21,R1:-1,R2:0, R3:0, R4:0,  pos:21, birdies:[3,2,2,2],eagles:[0,0,0,0],bogeys:[4,3,3,3]},
  {gId:22,R1:0, R2:0, R3:0, R4:0,  pos:22, birdies:[2,2,2,2],eagles:[0,0,0,0],bogeys:[3,3,3,3]},
  {gId:23,R1:0, R2:-1,R3:1, R4:0,  pos:23, birdies:[2,3,1,2],eagles:[0,0,0,0],bogeys:[3,4,2,3]},
  {gId:24,R1:0, R2:0, R3:0, R4:1,  pos:24, birdies:[2,2,2,1],eagles:[0,0,0,0],bogeys:[3,3,3,2]},
  {gId:25,R1:0, R2:1, R3:0, R4:0,  pos:25, birdies:[2,1,2,2],eagles:[0,0,0,0],bogeys:[3,2,3,3]},
  {gId:26,R1:-1,R2:1, R3:0, R4:1,  pos:26, birdies:[3,1,2,1],eagles:[0,0,0,0],bogeys:[4,2,3,2]},
  {gId:27,R1:0, R2:1, R3:0, R4:1,  pos:27, birdies:[2,1,2,1],eagles:[0,0,0,0],bogeys:[3,2,3,2]},
  {gId:28,R1:1, R2:0, R3:1, R4:0,  pos:28, birdies:[1,2,1,2],eagles:[0,0,0,0],bogeys:[2,3,2,3]},
  {gId:29,R1:0, R2:1, R3:1, R4:0,  pos:29, birdies:[2,1,1,2],eagles:[0,0,0,0],bogeys:[3,2,2,3]},
  {gId:30,R1:1, R2:1, R3:0, R4:1,  pos:30, birdies:[1,1,2,1],eagles:[0,0,0,0],bogeys:[2,2,3,2]},
  {gId:31,R1:1, R2:0, R3:1, R4:1,  pos:31, birdies:[1,2,1,1],eagles:[0,0,0,0],bogeys:[2,3,2,2]},
  {gId:32,R1:0, R2:1, R3:1, R4:1,  pos:32, birdies:[2,1,1,1],eagles:[0,0,0,0],bogeys:[3,2,2,2]},
  {gId:33,R1:1, R2:1, R3:1, R4:1,  pos:33, birdies:[1,1,1,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:34,R1:1, R2:2, R3:0, R4:1,  pos:34, birdies:[1,0,2,1],eagles:[0,0,0,0],bogeys:[2,2,3,2]},
  {gId:35,R1:2, R2:1, R3:0, R4:1,  pos:35, birdies:[0,1,2,1],eagles:[0,0,0,0],bogeys:[2,2,3,2]},
  {gId:36,R1:1, R2:1, R3:2, R4:1,  pos:36, birdies:[1,1,0,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:37,R1:2, R2:1, R3:1, R4:1,  pos:37, birdies:[0,1,1,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:38,R1:1, R2:2, R3:1, R4:1,  pos:38, birdies:[1,0,1,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:39,R1:2, R2:1, R3:2, R4:1,  pos:39, birdies:[0,1,0,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:40,R1:1, R2:2, R3:1, R4:2,  pos:40, birdies:[1,0,1,0],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:41,R1:2, R2:2, R3:1, R4:2,  pos:41, birdies:[0,0,1,0],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:42,R1:1, R2:2, R3:2, R4:2,  pos:42, birdies:[1,0,0,0],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:43,R1:2, R2:2, R3:2, R4:1,  pos:43, birdies:[0,0,0,1],eagles:[0,0,0,0],bogeys:[2,2,2,2]},
  {gId:44,R1:2, R2:2, R3:1, R4:3,  pos:44, birdies:[0,0,1,0],eagles:[0,0,0,0],bogeys:[2,2,1,3]},
  {gId:45,R1:3, R2:2, R3:2, R4:1,  pos:45, birdies:[0,0,0,1],eagles:[0,0,0,0],bogeys:[3,2,2,1]},
  {gId:46,R1:2, R2:3, R3:2, R4:2,  pos:46, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[2,3,2,2]},
  {gId:47,R1:3, R2:2, R3:3, R4:2,  pos:47, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,2,3,2]},
  {gId:48,R1:2, R2:3, R3:3, R4:2,  pos:48, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[2,3,3,2]},
  {gId:49,R1:3, R2:3, R3:2, R4:2,  pos:49, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,3,2,2]},
  {gId:50,R1:2, R2:3, R3:2, R4:3,  pos:50, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[2,3,2,3]},
  {gId:51,R1:3, R2:3, R3:3, R4:2,  pos:51, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,3,3,2]},
  {gId:52,R1:2, R2:3, R3:3, R4:3,  pos:52, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[2,3,3,3]},
  {gId:53,R1:3, R2:2, R3:3, R4:3,  pos:53, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,2,3,3]},
  {gId:54,R1:3, R2:3, R3:3, R4:3,  pos:54, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,3,3,3]},
  {gId:55,R1:4, R2:3, R3:3, R4:2,  pos:55, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,3,3,2]},
  {gId:56,R1:3, R2:4, R3:3, R4:3,  pos:56, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,4,3,3]},
  {gId:57,R1:4, R2:3, R3:4, R4:2,  pos:57, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,3,4,2]},
  {gId:58,R1:3, R2:4, R3:3, R4:4,  pos:58, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,4,3,4]},
  {gId:59,R1:4, R2:4, R3:3, R4:3,  pos:59, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,4,3,3]},
  {gId:60,R1:3, R2:4, R3:4, R4:4,  pos:60, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[3,4,4,4]},
  {gId:61,R1:4, R2:4, R3:4, R4:3,  pos:61, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,4,4,3]},
  {gId:62,R1:5, R2:4, R3:4, R4:3,  pos:62, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,4,4,3]},
  {gId:63,R1:4, R2:5, R3:4, R4:4,  pos:63, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,5,4,4]},
  {gId:64,R1:5, R2:4, R3:5, R4:4,  pos:64, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,4,5,4]},
  {gId:65,R1:4, R2:5, R3:5, R4:5,  pos:65, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[4,5,5,5]},
  {gId:66,R1:5, R2:5, R3:5, R4:4,  pos:66, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,5,5,4]},
  {gId:67,R1:5, R2:5, R3:4, R4:5,  pos:67, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,5,4,5]},
  {gId:68,R1:5, R2:5, R3:5, R4:5,  pos:68, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,5,5,5]},
  {gId:69,R1:6, R2:5, R3:5, R4:5,  pos:69, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[6,5,5,5]},
  {gId:70,R1:5, R2:6, R3:6, R4:5,  pos:70, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[5,6,6,5]},
  {gId:71,R1:6, R2:6, R3:5, R4:6,  pos:71, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[6,6,5,6]},
  {gId:72,R1:6, R2:6, R3:6, R4:5,  pos:72, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[6,6,6,5]},
  {gId:73,R1:6, R2:6, R3:6, R4:6,  pos:73, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[6,6,6,6]},
  {gId:74,R1:7, R2:6, R3:6, R4:6,  pos:74, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[7,6,6,6]},
  {gId:75,R1:6, R2:7, R3:6, R4:7,  pos:75, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[6,7,6,7]},
  {gId:76,R1:7, R2:7, R3:6, R4:6,  pos:76, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[7,7,6,6]},
  {gId:77,R1:7, R2:6, R3:7, R4:7,  pos:77, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[7,6,7,7]},
  {gId:78,R1:7, R2:7, R3:7, R4:7,  pos:78, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[7,7,7,7]},
  {gId:79,R1:8, R2:7, R3:7, R4:7,  pos:79, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[8,7,7,7]},
  {gId:80,R1:8, R2:8, R3:7, R4:7,  pos:80, birdies:[0,0,0,0],eagles:[0,0,0,0],bogeys:[8,8,7,7]},
];

// Pre-seeded draft picks for existing pools
// Pool p1 — "The Masters Pool 2026" (live, teamSize:4, scoringGolfers:2)
// Snake: R1: 1,2,3,4,5 | R2: 5,4,3,2,1 | R3: 1,2,3,4,5 | R4: 5,4,3,2,1
const POOL_DRAFT_PICKS = {
  p1: [
    {golferId:1, participantId:1, pickNum:0},   // James: Scheffler
    {golferId:2, participantId:2, pickNum:1},   // Sarah: McIlroy
    {golferId:3, participantId:3, pickNum:2},   // Mike:  Schauffele
    {golferId:4, participantId:4, pickNum:3},   // Emma:  Morikawa
    {golferId:5, participantId:5, pickNum:4},   // David: Hovland
    {golferId:6, participantId:5, pickNum:5},   // David: Rahm
    {golferId:7, participantId:4, pickNum:6},   // Emma:  Cantlay
    {golferId:8, participantId:3, pickNum:7},   // Mike:  Clark
    {golferId:9, participantId:2, pickNum:8},   // Sarah: Homa
    {golferId:10,participantId:1, pickNum:9},   // James: Harman
    {golferId:11,participantId:1, pickNum:10},  // James: Thomas
    {golferId:12,participantId:2, pickNum:11},  // Sarah: Spieth
    {golferId:13,participantId:3, pickNum:12},  // Mike:  Finau
    {golferId:14,participantId:4, pickNum:13},  // Emma:  Lowry
    {golferId:15,participantId:5, pickNum:14},  // David: Fleetwood
    {golferId:16,participantId:5, pickNum:15},  // David: Matsuyama
    {golferId:17,participantId:4, pickNum:16},  // Emma:  Theegala
    {golferId:18,participantId:3, pickNum:17},  // Mike:  Henley
    {golferId:19,participantId:2, pickNum:18},  // Sarah: Kirk
    {golferId:20,participantId:1, pickNum:19},  // James: N.Taylor
  ],
  p3: [
    {golferId:1, participantId:1, pickNum:0},
    {golferId:2, participantId:2, pickNum:1},
    {golferId:3, participantId:3, pickNum:2},
    {golferId:4, participantId:4, pickNum:3},
    {golferId:5, participantId:5, pickNum:4},
    {golferId:10,participantId:5, pickNum:5},
    {golferId:9, participantId:4, pickNum:6},
    {golferId:8, participantId:3, pickNum:7},
    {golferId:7, participantId:2, pickNum:8},
    {golferId:6, participantId:1, pickNum:9},
    {golferId:11,participantId:1, pickNum:10},
    {golferId:12,participantId:2, pickNum:11},
    {golferId:13,participantId:3, pickNum:12},
    {golferId:14,participantId:4, pickNum:13},
    {golferId:15,participantId:5, pickNum:14},
    {golferId:20,participantId:5, pickNum:15},
    {golferId:19,participantId:4, pickNum:16},
    {golferId:18,participantId:3, pickNum:17},
    {golferId:17,participantId:2, pickNum:18},
    {golferId:16,participantId:1, pickNum:19},
  ],
};

const SG_DATA = {
  1:{ott:1.4,app:1.2,arg:0.8,putt:0.8},2:{ott:1.6,app:0.9,arg:0.5,putt:0.8},
  3:{ott:0.9,app:1.1,arg:0.7,putt:0.7},4:{ott:0.6,app:1.3,arg:0.6,putt:0.6},
  5:{ott:1.2,app:0.8,arg:0.5,putt:0.4},6:{ott:1.1,app:0.9,arg:0.4,putt:0.3},
  7:{ott:0.5,app:1.0,arg:0.6,putt:0.5},8:{ott:1.3,app:0.7,arg:0.4,putt:0.0},
  9:{ott:0.8,app:0.8,arg:0.5,putt:0.2},10:{ott:0.4,app:0.9,arg:0.5,putt:0.5},
  11:{ott:0.7,app:0.8,arg:0.4,putt:0.1},12:{ott:0.5,app:0.6,arg:0.6,putt:0.3},
};

const SEED_POOLS = [
  {id:"p1",name:"The Masters Pool 2026",tournamentId:"t4",status:"live",participants:5,maxParticipants:8,yourRank:1,yourScore:-28,teamSize:4,scoringGolfers:2,cutLine:2,shotClock:60,created:"Feb 15",hostId:1},
  {id:"p2",name:"Sunday Showdown",tournamentId:"t1",status:"lobby",participants:3,maxParticipants:8,yourRank:null,yourScore:null,teamSize:3,scoringGolfers:2,cutLine:2,shotClock:60,created:"Mar 1",hostId:1},
  {id:"p3",name:"Office Golf Classic",tournamentId:"t2",status:"complete",participants:5,maxParticipants:6,yourRank:1,yourScore:-39,teamSize:4,scoringGolfers:3,cutLine:2,shotClock:45,created:"Jan 10",hostId:2},
];

// Seed accounts — stored in localStorage under "mgpp_accounts"
const SEED_ACCOUNTS = [];

// localStorage helpers
const LS = {
  get: (k,fb=null) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch{ return fb; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch{} },
};

const initAccounts = () => {
  const saved = LS.get("mgpp_accounts");
  if(!saved) { LS.set("mgpp_accounts", SEED_ACCOUNTS); return SEED_ACCOUNTS; }
  return saved;
};

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.REACT_APP_API_URL ||
  "https://golfpoolpro.onrender.com"
).replace(/\/$/, "");
const DEMO_EMAILS = new Set(["james@example.com","sarah@example.com","mike@example.com","emma@example.com","david@example.com"]);

const fmtTDate = (isoDate) => {
  if(!isoDate) return "TBD";
  const d = new Date(isoDate);
  if(Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
};

/* ─── HELPERS ─── */
const fmtScore = (s) => {
  if(s===null||s===undefined) return <span style={{color:"#CBD5E1"}}>—</span>;
  if(s===0) return <span className="even">E</span>;
  if(s<0) return <span className="under">{s}</span>;
  return <span className="over">+{s}</span>;
};

const Avatar = ({init,size=32,color="#1B4332"}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.35,fontWeight:700,flexShrink:0,letterSpacing:"0.5px"}}>
    {init}
  </div>
);

const CTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div className="ctt">
      <p style={{fontWeight:700,marginBottom:5,fontSize:11,color:"#78716C",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color,marginBottom:2}}>
          {p.name}: {typeof p.value==="number"&&p.value>0?`+${p.value}`:p.value}
        </p>
      ))}
    </div>
  );
};

function ShotClock({total,time}) {
  const r=42,circ=2*Math.PI*r;
  const pct=time/total;
  const col=time<=10?"#EF4444":time<=20?"#F59E0B":"#40916C";
  return (
    <div style={{position:"relative",width:96,height:96}}>
      <svg viewBox="0 0 100 100" style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="7"
          strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray .9s linear,stroke .3s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:time<=10?"#FCA5A5":"#fff",lineHeight:1}}>
          {time}
        </span>
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function GolfPoolPro() {
  const [view,setView] = useState(()=> LS.get("mgpp_session", null) ? "home" : "invite");
  const [adminTab,setAdminTab] = useState("config");
  const [analyticsTab,setAnalyticsTab] = useState("leaderboard");
  const [statsTab,setStatsTab] = useState("overview");
  const [statsPlayer,setStatsPlayer] = useState(null);
  const [pools,setPools] = useState(()=> LS.get("mgpp_pools", []));
  const [currentUser,setCurrentUser] = useState(()=> LS.get("mgpp_session", null));
  const [accounts,setAccounts] = useState(()=> initAccounts());
  const [tournaments,setTournaments] = useState([]);
  const [apiGolfers,setApiGolfers] = useState([]);
  const [tournamentCourse,setTournamentCourse] = useState(null);
  const [notification,setNotification] = useState(null);
  const [showTournamentInfo,setShowTournamentInfo] = useState(false);
  const [poolTab,setPoolTab] = useState("leaderboard");
  const [poolStatsTab,setPoolStatsTab] = useState("overview");
  const [poolStatsPlayer,setPoolStatsPlayer] = useState(null);
  const [confirmDelete,setConfirmDelete] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [passwordMsg,setPasswordMsg] = useState("");
  const [compareA,setCompareA] = useState(null);
  const [compareB,setCompareB] = useState(null);
  const [compareSearch,setCompareSearch] = useState("");

  // Active pool (when clicking into a pool from home)
  const [activePool,setActivePool] = useState(null);
  const [poolPhase,setPoolPhase] = useState("lobby"); // "lobby"|"draft"|"live"
  const [poolReadyMap,setPoolReadyMap] = useState({});
  // Pool-specific draft picks: {poolId: [{golferId, participantId, pickNum}]}
  const [allDrafted,setAllDrafted] = useState(()=> LS.get("mgpp_picks", {}));
  // Pool memberships: {poolId: [userId,...]}
  const [poolMembers,setPoolMembers] = useState(()=> LS.get("mgpp_members", {}));

  // Invite / auth state
  const [inviteView,setInviteView] = useState(false);
  const [invitePool,setInvitePool] = useState(null);
  const [authMode,setAuthMode] = useState("login"); // "login"|"signup"|"forgot"
  const [authEmail,setAuthEmail] = useState("");
  const [authPass,setAuthPass] = useState("");
  const [authName,setAuthName] = useState("");
  const [authError,setAuthError] = useState("");
  const [authSuccess,setAuthSuccess] = useState("");
  const [forgotSent,setForgotSent] = useState(false);

  // Config for new pool creation
  const [config,setConfig] = useState({
    poolName:"Sunday Showdown",tournament:"",maxParticipants:8,
    teamSize:4,scoringGolfers:2,cutLine:2,shotClock:60,draftOrderType:"ordered",
  });
  const [randomizedOrder,setRandomizedOrder] = useState([]);

  const [participants,setParticipants] = useState(()=> LS.get("mgpp_participants", []));
  const [drafted,setDrafted] = useState([]);
  const [currentPick,setCurrentPick] = useState(0);
  const [timer,setTimer] = useState(60);
  const [draftActive,setDraftActive] = useState(false);
  const [draftDone,setDraftDone] = useState(false);
  const [search,setSearch] = useState("");
  const [saved,setSaved] = useState(false);
  const timerRef = useRef(null);
  const [filterPos,setFilterPos] = useState("all");

  // Live scores state — updates every 5 minutes (matches GitHub Actions cron)
  const [liveScores,setLiveScores] = useState([]);
  const [lastUpdated,setLastUpdated] = useState(new Date());
  const [countdown,setCountdown] = useState(30);

  // ── Persist critical state to localStorage ──
  useEffect(()=>{ LS.set("mgpp_pools", pools); },[pools]);
  useEffect(()=>{ LS.set("mgpp_session", currentUser); },[currentUser]);
  useEffect(()=>{ LS.set("mgpp_picks", allDrafted); },[allDrafted]);
  useEffect(()=>{ LS.set("mgpp_members", poolMembers); },[poolMembers]);
  useEffect(()=>{ LS.set("mgpp_participants", participants); },[participants]);

  // One-time cleanup to remove legacy demo data from older localStorage sessions.
  useEffect(()=>{
    setAccounts(a=>a.filter(x=>!DEMO_EMAILS.has((x.email||"").toLowerCase())));
    setParticipants(p=>p.filter(x=>!DEMO_EMAILS.has((x.email||"").toLowerCase())));
    setPools(p=>p.filter(x=>!["p1","p2","p3"].includes(x.id)));
    setPoolMembers(m=>{
      const copy = {...m};
      delete copy.p1; delete copy.p2; delete copy.p3;
      return copy;
    });
    setAllDrafted(d=>{
      const copy = {...d};
      delete copy.p1; delete copy.p2; delete copy.p3;
      return copy;
    });
  },[]);

  // ── Handle invite links via URL hash e.g. #/join/p1 ──
  useEffect(()=>{
    const handleHash = () => {
      const hash = window.location.hash;
      const m = hash.match(/^#\/join\/(.+)/);
      if(m){
        const poolId = decodeURIComponent(m[1]);
        const pool = pools.find(p=>p.id===poolId);
        if(pool){ openInvite(pool); }
        else {
          // Pool not found — still show invite/login screen
          openInvite(null);
          notify("This invite link may have expired or the pool was deleted.","error");
        }
      }
    };
    handleHash(); // check on mount
    window.addEventListener("hashchange", handleHash);
    return ()=>window.removeEventListener("hashchange", handleHash);
  },[]); // eslint-disable-line

  // ── Clear hash after handling so back-button works ──
  const clearHash = () => {
    if(window.location.hash) history.pushState("","",window.location.pathname+window.location.search);
  };

  useEffect(()=>{
    const loadTournaments = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/tournaments/future`);
        const data = await resp.json();
        const mapped = (data.tournaments||[]).map(t=>({
          id: t.id,
          name: t.name,
          venue: t.venue || "TBD",
          date: fmtTDate(t.start_date || t.startDate),
          purse: t.purse ? `$${Number(t.purse).toLocaleString()}` : "TBD",
          field: t.field_size || t.field || 156
        }));
        setTournaments(mapped);
      } catch {
        setTournaments([]);
      }
    };
    loadTournaments();
  },[]);

  const selectedTournamentId = activePool?.tournamentId || config.tournamentId || config.tournament || "";

  useEffect(()=>{
    if(!selectedTournamentId){
      setApiGolfers([]);
      setLiveScores([]);
      setTournamentCourse(null);
      setCountdown(30);
      return;
    }

    const pull = async () => {
      try {
        const [{ golfers }, { scores }] = await Promise.all([
          Golfers.list(selectedTournamentId),
          Golfers.scores(selectedTournamentId),
        ]);

        setApiGolfers((golfers||[]).map(g=>({
          id: g.id,
          name: g.name,
          country: g.country || "🌍",
          rank: g.world_rank || 999,
          avg: Number(g.scoring_avg || 0),
          cut: 0,
          sg: Number(g.sg_total || 0),
          drivDist: g.driv_dist || 0,
          drivAcc: Number(g.driv_acc || 0),
          gir: Number(g.gir || 0),
          putts: Number(g.putts || 0),
        })));

        setLiveScores((scores||[]).map(s=>({
          gId: s.golfer?.id || s.golfer_id,
          R1: s.r1 ?? 0,
          R2: s.r2 ?? 0,
          R3: s.r3 ?? 0,
          R4: s.r4 ?? 0,
          pos: s.position ?? 999,
          birdies: s.birdies || [0,0,0,0],
          eagles: s.eagles || [0,0,0,0],
          bogeys: s.bogeys || [0,0,0,0],
        })));
        setLastUpdated(new Date());
      } catch {}
    };

    pull();
    setCountdown(30);
    const iv = setInterval(()=>setCountdown(c => c<=1 ? 30 : c-1), 1000);
    const refresh = setInterval(pull, 30000);
    return ()=>{ clearInterval(iv); clearInterval(refresh); };
  },[selectedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTournamentCourse(null);
      return;
    }
    let cancelled = false;
    const loadCourse = async () => {
      try {
        const resp = await Courses.forTournament(selectedTournamentId);
        if (!cancelled) setTournamentCourse(resp?.course || null);
      } catch {
        if (!cancelled) setTournamentCourse(null);
      }
    };
    loadCourse();
    return () => { cancelled = true; };
  }, [selectedTournamentId]);

  // Require login for all non-invite screens.
  useEffect(()=>{
    if(!currentUser && view!=="invite"){
      setActivePool(null);
      setView("invite");
      setInvitePool(null);
      setInviteView(true);
      setAuthMode("login");
      setAuthError("");
    }
    if(currentUser && !accounts.find(a=>a.id===currentUser)){
      setCurrentUser(null);
      setView("invite");
      setAuthMode("login");
    }
  },[currentUser, view, accounts]);

  // Active pool config
  const poolConfig = activePool || config;
  const golferCatalog = apiGolfers.length ? apiGolfers : FULL_FIELD;
  const poolTournamentField = (() => {
    const t = tournaments.find(x=>x.id===poolConfig.tournamentId||x.id===poolConfig.tournament);
    if(!t) return golferCatalog;
    return golferCatalog.filter(p=>p.rank<=Math.min(t.field,golferCatalog.length));
  })();
  const findGolferById = (id) => poolTournamentField.find(x=>x.id===id) || apiGolfers.find(x=>x.id===id) || FULL_FIELD.find(x=>x.id===id);

  const filteredField = poolTournamentField.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const joinedParticipants = participants.filter(p=>p.joined);

  // Get picks for active pool (or current draft)
  const activePicks = activePool ? (allDrafted[activePool.id]||[]) : drafted;

  const draftOrderType = activePool?.draftOrderType || config.draftOrderType || "ordered";

  // Build base participant order (randomized if pool uses random order)
  const baseParticipantOrder = (() => {
    const joined = joinedParticipants;
    if(draftOrderType === "random" && randomizedOrder.length === joined.length) {
      // Use stored random order so it stays consistent across renders
      return randomizedOrder.map(i => joined[i]).filter(Boolean);
    }
    return joined;
  })();

  const snakeOrder = (() => {
    const order=[];
    const n = baseParticipantOrder.length;
    const ts = activePool?.teamSize || config.teamSize;
    for(let r=0;r<ts;r++){
      const row = r%2===0 ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
      row.forEach(i=>order.push(i));
    }
    return order;
  })();

  const totalPicks = joinedParticipants.length * (activePool?.teamSize||config.teamSize);
  const currentParticipantIdx = draftActive&&!draftDone ? snakeOrder[currentPick] : null;
  const currentParticipant = currentParticipantIdx!==null ? baseParticipantOrder[currentParticipantIdx] : null;

  useEffect(()=>{
    if(!draftActive||draftDone) return;
    const sc = activePool?.shotClock||config.shotClock;
    setTimer(sc);
    timerRef.current = setInterval(()=>{
      setTimer(t=>{
        if(t<=1){ autoSkip(); return sc; }
        return t-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[currentPick,draftActive,draftDone]);

  const autoSkip = useCallback(()=>{
    const avail = poolTournamentField.filter(g=>!drafted.find(d=>d.golferId===g.id));
    if(avail.length) makePick(avail[0].id,true);
  },[drafted,currentPick,poolTournamentField]);

  const makePick = (golferId,auto=false) => {
    if(!draftActive||draftDone) return;
    clearInterval(timerRef.current);
    const pId = joinedParticipants[snakeOrder[currentPick]].id;
    const newPick = {golferId,participantId:pId,pickNum:currentPick,auto};
    setDrafted(d=>[...d,newPick]);
    if(activePool){
      setAllDrafted(ad=>({...ad,[activePool.id]:[...(ad[activePool.id]||[]),newPick]}));
    }
    const next = currentPick+1;
    if(next>=totalPicks){ setDraftDone(true); setDraftActive(false); return; }
    setCurrentPick(next);
    const sc = activePool?.shotClock||config.shotClock;
    setTimer(sc);
  };

  const startDraft = () => {
    // If random order, shuffle participant indices and store them
    if(draftOrderType === "random") {
      const indices = joinedParticipants.map((_,i)=>i);
      // Fisher-Yates shuffle
      for(let i=indices.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [indices[i],indices[j]]=[indices[j],indices[i]];
      }
      setRandomizedOrder(indices);
    } else {
      setRandomizedOrder([]);
    }
    setDraftActive(true);
    if(activePool) setAllDrafted(ad=>({...ad,[activePool.id]:[]}));
    setDrafted([]); setCurrentPick(0);
    setDraftDone(false);
    const sc = activePool?.shotClock||config.shotClock;
    setTimer(sc);
    setPoolPhase("draft");
  };

  const getTeam = (pId, picks=activePicks, field=poolTournamentField) =>
    picks.filter(d=>d.participantId===pId)
      .map(d=>field.find(g=>g.id===d.golferId)).filter(Boolean);

  const getTeamScore = (pId, sg=liveScores, picks=activePicks, field=poolTournamentField) => {
    const team = getTeam(pId, picks, field);
    const sc = activePool?.scoringGolfers || config.scoringGolfers;
    const scores = team.map(g=>{
      const ls = sg.find(l=>l.gId===g.id);
      if(!ls) return 0;
      return ls.R1+ls.R2+ls.R3+ls.R4;
    }).sort((a,b)=>a-b);
    return scores.slice(0,sc).reduce((s,v)=>s+v,0);
  };

  const standings = joinedParticipants.map(p=>({
    ...p,
    score:getTeamScore(p.id),
    team:getTeam(p.id),
    cutMade:getTeam(p.id).filter(g=>liveScores.find(l=>l.gId===g.id)).length
  })).sort((a,b)=>a.score-b.score);

  const notify = (msg,type="success") => {
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),3000);
  };

  const copyLink = (txt) => {
    navigator.clipboard?.writeText(txt);
    notify("Link copied to clipboard!");
  };

  const openPool = (pool) => {
    setActivePool(pool);
    if(pool.status==="live") setPoolPhase("live");
    else if(pool.status==="complete") setPoolPhase("live");
    else setPoolPhase("lobby");
    setPoolReadyMap({});
    setView("pool");
  };

  const openInvite = (pool) => {
    setInvitePool(pool);
    setInviteView(true);
    setAuthMode("login");
    setAuthEmail(""); setAuthPass(""); setAuthName(""); setAuthError(""); setAuthSuccess("");
    setForgotSent(false);
    setView("invite");
  };

  const joinPool = (userId, pool) => {
    if(!pool) return;
    // Add user to pool members
    setPoolMembers(m=>{
      const existing = m[pool.id]||[];
      if(existing.includes(userId)) return m;
      const updated = {...m, [pool.id]:[...existing, userId]};
      LS.set("mgpp_members", updated);
      return updated;
    });
    // Add as participant if not already present
    setParticipants(ps=>{
      const acct = accounts.find(a=>a.id===userId);
      if(!acct||ps.find(p=>p.id===userId)) return ps;
      return [...ps, {id:acct.id, name:acct.name, avatar:acct.avatar||acct.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), email:acct.email, token:`inv_${acct.id}_auto`, joined:true}];
    });
    // Update pool participant count
    setPools(ps=>ps.map(p=>p.id===pool.id?{...p,participants:Math.max(p.participants,(poolMembers[pool.id]||[]).length+1)}:p));
  };

  const ensureParticipant = (acct) => {
    if(!acct) return;
    setParticipants(ps=>{
      if(ps.find(p=>p.id===acct.id)) return ps;
      return [...ps, {
        id: acct.id,
        name: acct.name,
        avatar: acct.avatar || acct.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
        email: acct.email,
        token: `inv_${acct.id}_user`,
        joined: true
      }];
    });
  };

  const handleLogin = () => {
    const acct = accounts.find(a=>a.email.toLowerCase()===authEmail.toLowerCase()&&a.password===authPass);
    if(!acct){ setAuthError("Invalid email or password."); return; }
    ensureParticipant(acct);
    setCurrentUser(acct.id);
    LS.set("mgpp_session", acct.id);
    clearHash();
    if(invitePool){
      joinPool(acct.id, invitePool);
      notify(`Welcome back, ${acct.name.split(" ")[0]}! You've joined ${invitePool.name}.`);
      setActivePool(invitePool);
      setPoolPhase(invitePool.status==="live"?"live":invitePool.status==="complete"?"live":"lobby");
      setView("pool");
    } else {
      notify(`Welcome back, ${acct.name.split(" ")[0]}!`);
      setView("home");
    }
  };

  const handleSignup = () => {
    if(!authName.trim()||!authEmail.trim()||!authPass){ setAuthError("Please fill all fields."); return; }
    if(authPass.length<6){ setAuthError("Password must be at least 6 characters."); return; }
    const existing = accounts.find(a=>a.email.toLowerCase()===authEmail.toLowerCase());
    if(existing){ setAuthError("An account with this email already exists. Please log in."); return; }
    const newId = Math.max(...accounts.map(a=>a.id),5)+1;
    const avatar = authName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const newAcct = {id:newId, name:authName.trim(), email:authEmail.trim().toLowerCase(), password:authPass, avatar};
    const updated = [...accounts, newAcct];
    setAccounts(updated);
    ensureParticipant(newAcct);
    LS.set("mgpp_accounts", updated);
    setCurrentUser(newId);
    LS.set("mgpp_session", newId);
    clearHash();
    if(invitePool){
      joinPool(newId, invitePool);
      notify(`Account created! Welcome, ${authName.split(" ")[0]}! You've joined ${invitePool.name}.`);
      setActivePool(invitePool);
      setPoolPhase(invitePool.status==="live"?"live":invitePool.status==="complete"?"live":"lobby");
      setView("pool");
    } else {
      notify(`Welcome to MyGolfPoolPro, ${authName.split(" ")[0]}!`);
      setView("home");
    }
  };

  const handleForgotPassword = () => {
    if(!authEmail){ setAuthError("Enter your email above first."); return; }
    const acct = accounts.find(a=>a.email.toLowerCase()===authEmail.toLowerCase());
    // Always show success (don't reveal if email exists)
    setForgotSent(true);
    setAuthError("");
    notify("Password reset email sent!");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowSettings(false);
    setActivePool(null);
    setInvitePool(null);
    setInviteView(false);
    setAuthMode("login");
    setAuthEmail("");
    setAuthPass("");
    setAuthName("");
    setAuthError("");
    setAuthSuccess("");
    setView("invite");
    setInviteView(true);
    clearHash();
    try {
      localStorage.removeItem("mgpp_session");
      localStorage.removeItem("mgpp_token");
      localStorage.removeItem("mgpp_user");
    } catch {}
    notify("Logged out.");
  };

  // Stats helpers
  const getPlayerRounds = (gId) => {
    const ls = liveScores.find(l=>l.gId===gId);
    if(!ls) return [];
    return [1,2,3,4].map(r=>({
      round:`R${r}`,
      score:ls[`R${r}`],
      birdies:ls.birdies[r-1]||0,
      eagles:ls.eagles[r-1]||0,
      bogeys:ls.bogeys[r-1]||0,
      pars:18-(ls.birdies[r-1]||0)-(ls.eagles[r-1]||0)-(ls.bogeys[r-1]||0),
    }));
  };

  const getSGData = (gId) => {
    const sg = SG_DATA[gId];
    if(!sg) return [];
    return [
      {stat:"Off Tee",value:sg.ott,fullMark:2.0},
      {stat:"Approach",value:sg.app,fullMark:2.0},
      {stat:"Around Green",value:sg.arg,fullMark:2.0},
      {stat:"Putting",value:sg.putt,fullMark:2.0},
    ];
  };

  // Check if all joined participants are ready
  const readyCount = Object.values(poolReadyMap).filter(Boolean).length;
  const allReady = joinedParticipants.length>0 && readyCount>=joinedParticipants.length;

  // Auto-launch when all ready
  useEffect(()=>{
    if(allReady && poolPhase==="lobby" && view==="pool"){
      const t = setTimeout(()=>{ startDraft(); }, 1500);
      return ()=>clearTimeout(t);
    }
  },[allReady]);

  /* ─── RENDER ─── */
  return (
    <>
      <style>{CSS}</style>
      {notification && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:notification.type==="success"?"var(--forest)":"var(--red)",color:"#fff",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:600,boxShadow:"var(--sh-md)",animation:"fadeUp .25s ease"}}>
          {notification.msg}
        </div>
      )}
      <div style={{minHeight:"100vh"}}>

        {/* ── NAV ── Only show on non-invite views */}
        {view!=="invite" && (
          <>
          <nav className="nav">
            <div className="logo" onClick={()=>{setView("home");setActivePool(null);}}>My<em>Golf</em><span style={{color:"var(--gold)"}}>PoolPro</span></div>
            <div className="nav-links">
              {[["home","🏠 My Pools"]].map(([v,l])=>(
                <button key={v} className={`ntab ${view===v||view==="pool"||view==="admin"?"on":""}`} onClick={()=>{setView("home");setActivePool(null);}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div className="nav-user">
                <Avatar init={currentUser ? (accounts.find(a=>a.id===currentUser)?.avatar||"AD") : "AD"} size={24} color="var(--gold)"/>
                <span>{currentUser ? (accounts.find(a=>a.id===currentUser)?.name||"Account").split(" ")[0] : "Guest"}</span>
              </div>
              <button onClick={()=>{setShowSettings(s=>!s);setPasswordMsg("");setNewPassword("");setConfirmPassword("");}}
                style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${showSettings?"rgba(200,169,79,.5)":"rgba(255,255,255,.18)"}`,background:showSettings?"rgba(200,169,79,.15)":"rgba(255,255,255,.06)",color:showSettings?"var(--gold)":"rgba(255,255,255,.55)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}>
                ⚙ Settings
              </button>
              <button onClick={handleLogout} style={{padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,.18)",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.55)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}
                onMouseEnter={e=>{e.target.style.background="rgba(220,38,38,.25)";e.target.style.color="#FCA5A5";e.target.style.borderColor="rgba(220,38,38,.4)";}}
                onMouseLeave={e=>{e.target.style.background="rgba(255,255,255,.06)";e.target.style.color="rgba(255,255,255,.55)";e.target.style.borderColor="rgba(255,255,255,.18)";}}>
                Log out
              </button>
            </div>
          </nav>
          {/* ──────── SETTINGS PANEL ──────── */}
          {showSettings && (()=>{
            const user = participants.find(p=>p.id===(currentUser||1));
            const account = accounts.find(a=>a.id===(currentUser||1));
            return (
              <div style={{position:"fixed",top:66,right:16,zIndex:400,width:320,background:"#fff",borderRadius:16,boxShadow:"0 16px 48px rgba(27,67,50,.18),0 4px 12px rgba(27,67,50,.08)",border:"1px solid rgba(27,67,50,.08)",overflow:"hidden"}}>
                <div style={{background:"var(--forest)",padding:"18px 20px",display:"flex",alignItems:"center",gap:12}}>
                  <Avatar init={user?.avatar||"AD"} size={40} color="var(--gold)"/>
                  <div>
                    <p style={{fontWeight:700,color:"#fff",fontSize:14}}>{user?.name||"Admin"}</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:1}}>{account?.email||"admin@example.com"}</p>
                  </div>
                  <button onClick={()=>setShowSettings(false)} style={{marginLeft:"auto",background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:18,cursor:"pointer",lineHeight:1,padding:4}}>×</button>
                </div>
                <div style={{padding:"16px 20px"}}>
                  <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".8px",color:"var(--forest-mid)",marginBottom:12}}>Account Details</p>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                    <div style={{background:"var(--cream)",borderRadius:9,padding:"10px 14px"}}>
                      <p style={{fontSize:10,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",marginBottom:3}}>Username</p>
                      <p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{user?.name||"Admin"}</p>
                    </div>
                    <div style={{background:"var(--cream)",borderRadius:9,padding:"10px 14px"}}>
                      <p style={{fontSize:10,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",marginBottom:3}}>Email</p>
                      <p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{account?.email||"admin@example.com"}</p>
                    </div>
                    <div style={{background:"var(--cream)",borderRadius:9,padding:"10px 14px"}}>
                      <p style={{fontSize:10,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".6px",marginBottom:3}}>Password</p>
                      <p style={{fontSize:14,fontWeight:600,color:"var(--text)",letterSpacing:"3px"}}>••••••••</p>
                    </div>
                  </div>
                  <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".8px",color:"var(--forest-mid)",marginBottom:10}}>Change Password</p>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <input className="inp" type="password" placeholder="New password"
                      value={newPassword} onChange={e=>{setNewPassword(e.target.value);setPasswordMsg("");}}
                      style={{fontSize:13,padding:"9px 12px"}}/>
                    <input className="inp" type="password" placeholder="Confirm new password"
                      value={confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);setPasswordMsg("");}}
                      style={{fontSize:13,padding:"9px 12px"}}/>
                    {passwordMsg&&<p style={{fontSize:12,color:passwordMsg.includes("✓")?"var(--green)":"var(--red)",fontWeight:600}}>{passwordMsg}</p>}
                    <button className="btn btn-prim" style={{width:"100%",justifyContent:"center",fontSize:13,padding:"9px"}}
                      onClick={()=>{
                        if(!newPassword) return setPasswordMsg("Please enter a new password.");
                        if(newPassword.length<6) return setPasswordMsg("Password must be at least 6 characters.");
                        if(newPassword!==confirmPassword) return setPasswordMsg("Passwords don't match.");
                        setPasswordMsg("✓ Password updated successfully!");
                        setNewPassword(""); setConfirmPassword("");
                        setTimeout(()=>setPasswordMsg(""),3000);
                      }}>
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          </>
        )}

        {/* ──────── HOME PAGE ──────── */}
        {view==="home" && (
          <div>
            <div className="hero">
              <div style={{position:"relative",zIndex:1}}>
                <h1 className="hero-title">My<span>Golf</span>PoolPro</h1>
                <p className="hero-sub">Your premier platform for high-stakes golf pool competitions. Draft smarter, track deeper, win bigger.</p>
              </div>
            </div>
            <div className="page">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
                <div>
                  <h2 className="h2">My Pools</h2>
                  <p className="sub">{pools.length} pools · {pools.filter(p=>p.status==="live").length} active</p>
                </div>
                <button className="btn btn-prim" onClick={()=>setView("admin")}>+ New Pool</button>
              </div>
              <div className="g3" style={{marginBottom:40}}>
                {pools.map(pool=>{
                  const t = tournaments.find(x=>x.id===pool.tournamentId);
                  return (
                    <div key={pool.id} className={`pool-card ${pool.status}`} onClick={()=>openPool(pool)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <h3 className="h4">{pool.name}</h3>
                        <span className={`badge ${pool.status==="live"?"bg-red":pool.status==="lobby"?"bg-gold":pool.status==="complete"?"bg-gray":"bg-forest"}`}>
                          {pool.status==="live"&&<span className="live-dot"/>}
                          {pool.status.charAt(0).toUpperCase()+pool.status.slice(1)}
                        </span>
                      </div>
                      <p style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginBottom:4}}>{t?.name||"—"}</p>
                      <p style={{fontSize:12,color:"var(--muted)",marginBottom:16}}>{t?.venue} · {t?.date}</p>
                      <div style={{display:"flex",gap:10,marginBottom:14}}>
                        {[
                          [pool.participants+"/"+pool.maxParticipants,"Players"],
                          [pool.teamSize+" golfers","Team"],
                          ["Best "+pool.scoringGolfers,"Scoring"],
                        ].map(([v,l])=>(
                          <div key={l} style={{flex:1,background:"var(--cream)",borderRadius:8,padding:"7px 10px",textAlign:"center"}}>
                            <div style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>{v}</div>
                            <div style={{fontSize:10,color:"var(--muted)"}}>{l}</div>
                          </div>
                        ))}
                      </div>
                      {pool.yourRank && (
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:pool.yourRank===1?"var(--gold-pale)":"var(--cream-2)",borderRadius:9,padding:"8px 12px"}}>
                          <span style={{fontSize:12,fontWeight:600,color:"var(--muted)"}}>Your rank</span>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:pool.yourRank===1?"#7A5C00":"var(--forest)"}}>#{pool.yourRank}</span>
                            {fmtScore(pool.yourScore)}
                          </div>
                        </div>
                      )}
                      {pool.status==="lobby"&&(
                        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:"var(--gold)",animation:"blink 1.4s ease infinite"}}/>
                          <span style={{fontSize:12,color:"var(--muted)"}}>Waiting in lobby — click to join</span>
                        </div>
                      )}
                      <div style={{marginTop:10,fontSize:12,color:"var(--muted)"}}>Created {pool.created}</div>
                    </div>
                  );
                })}
                {/* New pool card */}
                <div className="pool-card" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,minHeight:260,border:"2px dashed var(--parchment)",background:"transparent",boxShadow:"none"}}
                  onClick={()=>setView("admin")}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"var(--cream-2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>+</div>
                  <p style={{fontWeight:600,color:"var(--muted)"}}>Create New Pool</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {(()=>{
                  const activePools = pools.filter(p=>p.status==="live"||p.status==="lobby");
                  const finishedPools = pools.filter(p=>p.yourRank!=null);
                  const bestFinish = finishedPools.length ? Math.min(...finishedPools.map(p=>p.yourRank)) : null;
                  return [
                    {n: pools.length, l: pools.length===1?"Pool":"Pools", sub:"You're in"},
                    {n: bestFinish ? `#${bestFinish}` : "—", l: "Best Finish", sub: finishedPools.length ? `across ${finishedPools.length} pool${finishedPools.length>1?"s":""}` : "No results yet"},
                  ].map(s=>(
                    <div key={s.l} className="card" style={{textAlign:"center",padding:"20px 16px"}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:700,color:"var(--gold)",lineHeight:1}}>{s.n}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginTop:4}}>{s.l}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.sub}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ──────── POOL VIEW (Lobby → Draft → Live) ──────── */}
        {view==="pool" && activePool && (
          <div>
            {/* Pool header bar */}
            <div style={{background:"var(--forest)",padding:"16px 28px",display:"flex",alignItems:"center",gap:16}}>
              <button className="btn btn-sm" style={{background:"rgba(255,255,255,.1)",color:"#fff",border:"1px solid rgba(255,255,255,.2)"}} onClick={()=>{setView("home");setActivePool(null);setConfirmDelete(false);}}>← Back</button>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#fff"}}>{activePool.name}</span>
                  <span className={`badge ${activePool.status==="live"?"bg-red":activePool.status==="lobby"?"bg-gold":"bg-gray"}`}>
                    {activePool.status==="live"&&<span className="live-dot"/>}
                    {poolPhase==="draft"?"Drafting":activePool.status.charAt(0).toUpperCase()+activePool.status.slice(1)}
                  </span>
                </div>
                <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{tournaments.find(t=>t.id===activePool.tournamentId)?.name}</p>
              </div>
              {(activePool.status==="live"||poolPhase==="live") && (
                <div className="update-bar" style={{background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",margin:0}}>
                  <div className="pulse-dot"/>
                  <span>Live · updates in {Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")} · {lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              )}
              {/* Delete button — host only */}
              {activePool.hostId === (currentUser||1) && (
                confirmDelete ? (
                  <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(220,38,38,.15)",border:"1px solid rgba(220,38,38,.4)",borderRadius:10,padding:"8px 12px"}}>
                    <span style={{fontSize:12,color:"#FCA5A5",fontWeight:600}}>Delete this pool?</span>
                    <button onClick={()=>{
                      setPools(ps=>ps.filter(p=>p.id!==activePool.id));
                      setActivePool(null);
                      setView("home");
                      setConfirmDelete(false);
                      notify("Pool deleted.","success");
                    }} style={{padding:"4px 12px",borderRadius:7,border:"none",background:"#DC2626",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      Yes, Delete
                    </button>
                    <button onClick={()=>setConfirmDelete(false)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.6)",fontSize:12,cursor:"pointer"}}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>setConfirmDelete(true)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid rgba(220,38,38,.35)",background:"rgba(220,38,38,.12)",color:"#FCA5A5",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,.25)";e.currentTarget.style.borderColor="rgba(220,38,38,.6)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(220,38,38,.12)";e.currentTarget.style.borderColor="rgba(220,38,38,.35)";}}>
                    🗑 Delete Pool
                  </button>
                )
              )}
            </div>

            {/* ── LOBBY PHASE ── */}
            {poolPhase==="lobby" && (
              <div className="page">
                <div className="phase-banner" style={{marginBottom:28}}>
                  <div style={{position:"relative",zIndex:1}}>
                    <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(255,255,255,.6)",marginBottom:6}}>Draft Lobby</p>
                    <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:"#fff",marginBottom:8}}>{activePool.name}</h2>
                    <p style={{color:"rgba(255,255,255,.7)",fontSize:14}}>{readyCount}/{joinedParticipants.length} participants ready{allReady?" · Launching draft…":""}</p>
                  </div>
                </div>

                {allReady && (
                  <div style={{background:"var(--gold-pale)",border:"2px solid var(--gold)",borderRadius:12,padding:"16px 20px",marginBottom:20,display:"flex",gap:14,alignItems:"center"}}>
                    <span style={{fontSize:28}}>🚀</span>
                    <div>
                      <p style={{fontWeight:700,color:"#7A5C00",fontSize:15}}>All players ready! Draft starting…</p>
                      <p style={{fontSize:13,color:"#92600A"}}>Get ready to make your picks!</p>
                    </div>
                  </div>
                )}

                <div className="g2" style={{marginBottom:24}}>
                  <div>
                    <h3 className="h3" style={{marginBottom:14}}>Participants — Ready Up!</h3>
                    <div className="ready-grid">
                      {joinedParticipants.map(p=>{
                        const isReady = !!poolReadyMap[p.id];
                        return (
                          <div key={p.id} className={`ready-card ${isReady?"is-ready":""}`}>
                            <Avatar init={p.avatar} color={isReady?"var(--green)":"var(--forest)"} size={36}/>
                            <div style={{flex:1}}>
                              <p style={{fontWeight:600,fontSize:13}}>{p.name}</p>
                              <p style={{fontSize:11,color:isReady?"var(--green)":"var(--muted)"}}>
                                {isReady?"✓ Ready":"Waiting…"}
                              </p>
                            </div>
                            {!isReady && (
                              <button className="btn-ready" onClick={()=>setPoolReadyMap(m=>({...m,[p.id]:true}))}>
                                Ready
                              </button>
                            )}
                            {isReady && <span style={{fontSize:20}}>✅</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!allReady && (
                      <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>{
                        const allMap = {};
                        joinedParticipants.forEach(p=>{ allMap[p.id]=true; });
                        setPoolReadyMap(allMap);
                      }}>Mark All Ready (Admin)</button>
                    )}
                  </div>
                  <div>
                    <h3 className="h3" style={{marginBottom:14}}>Pool Settings</h3>
                    <div className="card" style={{marginBottom:16}}>
                      {[
                        {l:"Tournament",v:tournaments.find(t=>t.id===activePool.tournamentId)?.name||"—",i:"⛳"},
                        {l:"Field Size",v:`${poolTournamentField.length} players`,i:"👤"},
                        {l:"Draft Format",v:`Snake · ${activePool.teamSize} rounds`,i:"🔄"},
                        {l:"Scoring",v:`Best ${activePool.scoringGolfers} of ${activePool.teamSize}`,i:"🎯"},
                        {l:"Shot Clock",v:`${activePool.shotClock}s`,i:"⏱️"},
                        {l:"Cut Threshold",v:`${activePool.cutLine} must make cut`,i:"✂️"},
                      ].map(s=>(
                        <div key={s.l} style={{display:"flex",gap:12,alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                          <span style={{fontSize:18}}>{s.i}</span>
                          <div style={{flex:1}}>
                            <p style={{fontSize:11,color:"var(--muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.l}</p>
                            <p style={{fontWeight:600,fontSize:13,color:"var(--forest)"}}>{s.v}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="card">
                      <h4 className="h4" style={{marginBottom:8}}>Invite More Players</h4>
                      <p className="sub" style={{marginBottom:12,fontSize:13}}>Share this link so others can log in or create an account to join.</p>
                      <div className="link-box" style={{marginBottom:10}}>
                        <span className="link-txt">mygolfpoolpro.com/join/{activePool.id}</span>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>copyLink(`https://mygolfpoolpro.com/join/${activePool.id}`)}>Copy</button>
                          <button className="btn btn-prim btn-sm" onClick={()=>openInvite(activePool)}>Preview</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Draft order preview */}
                <div className="card">
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:8}}>
                    <h3 className="h3">Draft Order Preview</h3>
                    <span style={{fontSize:12,background:draftOrderType==="random"?"rgba(200,169,79,.12)":"rgba(27,67,50,.07)",color:draftOrderType==="random"?"#7A5C00":"var(--forest)",padding:"3px 10px",borderRadius:20,fontWeight:700}}>
                      {draftOrderType==="random"?"🎲 Random Order":"🔢 Ordered"} · Snake
                    </span>
                  </div>
                  <p style={{fontSize:12,color:"var(--muted)",marginBottom:14}}>
                    {draftOrderType==="random"
                      ? "Order is randomized when draft starts — no one knows the lineup until the clock begins"
                      : "Snake order — reverses each round"}
                  </p>
                  <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                    {[...Array(Math.min(activePool.teamSize,4))].map((_,round)=>(
                      <div key={round}>
                        <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.7px",color:"var(--muted)",marginBottom:6}}>Round {round+1}</p>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          {(()=>{
                            const orderedIdx = round%2===0
                              ? [...Array(baseParticipantOrder.length).keys()]
                              : [...Array(baseParticipantOrder.length).keys()].reverse();
                            return orderedIdx.map(i=>(
                              <div key={i} title={baseParticipantOrder[i]?.name}
                                style={{width:32,height:32,borderRadius:8,background:`rgba(27,67,50,${0.1+i*0.02})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"var(--forest)"}}>
                                {draftOrderType==="random" && randomizedOrder.length===0 ? "?" : baseParticipantOrder[i]?.avatar}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                  {draftOrderType==="random" && randomizedOrder.length===0 && (
                    <p style={{fontSize:11,color:"var(--muted)",marginTop:10,fontStyle:"italic"}}>
                      🎲 Draft order will be revealed when the host starts the draft
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── DRAFT PHASE ── */}
            {poolPhase==="draft" && (
              <div className="page-wide">
                {!draftActive && !draftDone && (
                  <div style={{textAlign:"center",padding:"80px 40px"}}>
                    <p style={{fontSize:56,marginBottom:16}}>🏌️</p>
                    <h2 className="h2" style={{marginBottom:10}}>Ready to Draft</h2>
                    <p className="sub" style={{marginBottom:28}}>{poolTournamentField.length} golfers available · Best {activePool.scoringGolfers} of {activePool.teamSize} count</p>
                    <button className="btn btn-gold" style={{fontSize:16,padding:"14px 32px"}} onClick={startDraft}>Start Draft →</button>
                  </div>
                )}
                {draftDone && (
                  <div style={{textAlign:"center",padding:"60px 40px"}}>
                    <p style={{fontSize:56,marginBottom:14}}>🎉</p>
                    <h2 className="h2" style={{marginBottom:8}}>Draft Complete!</h2>
                    <p className="sub" style={{marginBottom:24}}>All picks made. Good luck everyone!</p>
                    <button className="btn btn-prim" onClick={()=>setPoolPhase("live")}>View Pool Standings →</button>
                  </div>
                )}
                {(draftActive||draftDone) && (
                  <div className="draft-layout">
                    {/* LEFT */}
                    <div className="draft-panel">
                      <div className="panel-hdr">
                        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Draft Order</span>
                        <span className="badge bg-forest">{drafted.length}/{totalPicks}</span>
                      </div>
                      <div style={{flex:1,overflowY:"auto",padding:10}}>
                        {joinedParticipants.map((p,i)=>{
                          const picks=getTeam(p.id,drafted);
                          const isNow=draftActive&&!draftDone&&currentParticipant?.id===p.id;
                          const isDone=picks.length>=(activePool?.teamSize||config.teamSize);
                          return (
                            <div key={p.id} className={`order-row ${isNow?"cur":""} ${isDone&&!isNow?"done":""}`}>
                              <span style={{fontSize:11,fontWeight:700,color:"var(--muted)",width:16}}>{i+1}</span>
                              <Avatar init={p.avatar} size={26} color={isNow?"var(--gold)":"var(--forest)"}/>
                              <div style={{flex:1,marginLeft:7}}>
                                <p style={{fontSize:12,fontWeight:600,lineHeight:1.2}}>{p.name}</p>
                                <p style={{fontSize:10,color:"var(--muted)"}}>{picks.length}/{activePool?.teamSize||config.teamSize} picks</p>
                              </div>
                              {isNow&&<span style={{fontSize:9,fontWeight:700,color:"var(--gold)",background:"rgba(200,169,79,.12)",padding:"2px 6px",borderRadius:4}}>NOW</span>}
                              {isDone&&!isNow&&<span style={{fontSize:9,color:"var(--green)"}}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                      {draftActive&&!draftDone&&(
                        <div className="clock-wrap">
                          <ShotClock total={activePool?.shotClock||config.shotClock} time={timer}/>
                          <p style={{fontSize:12,color:"rgba(255,255,255,.65)"}}>On the Clock</p>
                          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"var(--gold-light)",textAlign:"center"}}>{currentParticipant?.name}</p>
                        </div>
                      )}
                    </div>

                    {/* CENTER */}
                    <div className="draft-panel">
                      <div className="panel-hdr">
                        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Available Players</span>
                        <span className="badge bg-gold">{poolTournamentField.length-drafted.length} left</span>
                      </div>
                      <div style={{padding:"10px 10px 6px",flexShrink:0}}>
                        <div className="search-wrap">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                          <input className="inp search-inp" placeholder="Search players..." value={search} onChange={e=>setSearch(e.target.value)} style={{fontSize:13}}/>
                        </div>
                      </div>
                      <div style={{flex:1,overflowY:"auto",padding:"0 10px 10px"}}>
                        {filteredField.filter(g=>!drafted.find(d=>d.golferId===g.id)).map(g=>{
                          const isMyTurn=draftActive&&!draftDone&&(!currentUser||currentParticipant?.id===currentUser);
                          return (
                            <div key={g.id} className="pick-row"
                              onClick={()=>isMyTurn&&makePick(g.id)}>
                              <div style={{width:26,height:26,borderRadius:7,background:"var(--forest)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>
                                {g.rank}
                              </div>
                              <div style={{flex:1}}>
                                <p style={{fontSize:13,fontWeight:600,lineHeight:1.2}}>{g.country} {g.name}</p>
                                <p style={{fontSize:11,color:"var(--muted)"}}>Avg {g.avg} · SG {g.sg>0?"+":""}{g.sg}</p>
                              </div>
                              <p style={{fontSize:12,fontWeight:700,color:"var(--forest)",flexShrink:0}}>{g.drivDist} yds</p>
                            </div>
                          );
                        })}
                        {filteredField.filter(g=>!drafted.find(d=>d.golferId===g.id)).length===0&&(
                          <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:"40px 0"}}>No available players found</p>
                        )}
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="draft-panel">
                      <div className="panel-hdr">
                        <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Teams</span>
                        <span style={{fontSize:11,color:"var(--muted)"}}>Best {activePool?.scoringGolfers||config.scoringGolfers} count</span>
                      </div>
                      <div style={{flex:1,overflowY:"auto",padding:10}}>
                        {joinedParticipants.map(p=>{
                          const picks=getTeam(p.id,drafted);
                          return (
                            <div key={p.id} style={{marginBottom:12,background:"var(--cream)",borderRadius:11,padding:"11px 12px",border:"1px solid var(--parchment)"}}>
                              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}>
                                <Avatar init={p.avatar} size={24} color="var(--forest)"/>
                                <p style={{fontSize:12,fontWeight:700,color:"var(--forest)",flex:1}}>{p.name}</p>
                                <span style={{fontSize:10,color:"var(--muted)"}}>{picks.length}/{activePool?.teamSize||config.teamSize}</span>
                              </div>
                              {picks.map((g,gi)=>(
                                <div key={g.id} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",borderTop:gi>0?"1px dotted var(--parchment)":"none"}}>
                                  <span style={{fontSize:10,width:18,color:"var(--muted)",fontWeight:700}}>#{g.rank}</span>
                                  <span style={{fontSize:12,flex:1}}>{g.name.split(" ").pop()}</span>
                                </div>
                              ))}
                              {picks.length<(activePool?.teamSize||config.teamSize)&&<p style={{fontSize:10,color:"var(--muted)",fontStyle:"italic",marginTop:4}}>{(activePool?.teamSize||config.teamSize)-picks.length} more…</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LIVE / STANDINGS PHASE ── */}
            {poolPhase==="live" && (()=>{
              // Compute pool-specific standings using this pool's picks
              const poolPicks = allDrafted[activePool.id] || [];
              const sc = activePool.scoringGolfers;
              const ts = activePool.teamSize;
              const poolField = poolTournamentField;

              const getPoolTeam = (pId) =>
                poolPicks.filter(d=>d.participantId===pId)
                  .map(d=>poolField.find(g=>g.id===d.golferId)).filter(Boolean);

              const getPoolScore = (pId) => {
                const team = getPoolTeam(pId);
                const scores = team.map(g=>{
                  const ls=liveScores.find(l=>l.gId===g.id);
                  return ls ? ls.R1+ls.R2+ls.R3+ls.R4 : 0;
                }).sort((a,b)=>a-b);
                return scores.slice(0,sc).reduce((s,v)=>s+v,0);
              };

              // All golfers drafted in this pool (for pool-specific stats)
              const draftedGolferIds = new Set(poolPicks.map(p=>p.golferId));
              const poolGolfers = poolField.filter(g=>draftedGolferIds.has(g.id));

              const poolStandings = joinedParticipants.map(p=>({
                ...p,
                score: getPoolScore(p.id),
                team: getPoolTeam(p.id),
                cutMade: getPoolTeam(p.id).filter(g=>liveScores.find(l=>l.gId===g.id)).length
              })).sort((a,b)=>a.score-b.score);

              return (
              <div className="page">
                <div className="update-bar">
                  <div className="pulse-dot"/>
                  <span>Live scores · refreshing every 30s · Last updated {lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})} · Next in {countdown}s</span>
                </div>

                {/* Pool standings header cards — uses poolStandings with real scores */}
                <div className="g4" style={{marginBottom:20}}>
                  {poolStandings.slice(0,4).map((p,i)=>{
                    const teamScores = p.team.map(g=>{
                      const ls=liveScores.find(l=>l.gId===g.id);
                      return {g, tot: ls?ls.R1+ls.R2+ls.R3+ls.R4:null};
                    }).sort((a,b)=>(a.tot??999)-(b.tot??999));
                    return (
                      <div key={p.id} className="card" style={{padding:18,border:i===0?"2px solid var(--gold)":"1px solid rgba(27,67,50,.06)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <Avatar init={p.avatar} color={["var(--gold)","#94A3B8","#CD7F32","var(--forest)"][i]}/>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:i===0?"var(--gold)":"var(--muted)",lineHeight:1}}>#{i+1}</span>
                        </div>
                        <p style={{fontWeight:700,fontSize:14,marginBottom:2}}>{p.name}</p>
                        <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:10}}>
                          {fmtScore(p.score)}
                          <span style={{fontSize:11,color:"var(--muted)"}}>best {sc}</span>
                        </div>
                        {/* Show each golfer with their live score */}
                        {teamScores.map(({g,tot},gi)=>(
                          <div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",opacity:gi<sc?1:0.45}}>
                            <span style={{fontSize:11,color:"var(--muted)",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {gi<sc&&<span style={{color:"var(--gold)",marginRight:4}}>★</span>}
                              {g.name.split(" ").pop()}
                            </span>
                            <span style={{fontSize:12,fontWeight:gi<sc?700:400}}>{fmtScore(tot)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div className="tabs" style={{maxWidth:700}}>
                  {[["leaderboard","🏆 Leaderboard"],["teams","👥 Teams"],["chart","📈 Performance"],["prob","🎲 Win %"],["stats","📊 Statistics"]].map(([t,l])=>(
                    <button key={t} className={`tab ${poolTab===t?"on":""}`} onClick={()=>setPoolTab(t)}>{l}</button>
                  ))}
                </div>

                {poolTab==="leaderboard" && (
                  <div className="card" style={{padding:0,overflow:"hidden"}}>
                    <div className="lb-row lb-hdr" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px"}}>
                      <span>Pos</span><span>Player</span><span style={{textAlign:"right"}}>R1</span><span style={{textAlign:"right"}}>R2</span><span style={{textAlign:"right"}}>R3</span><span style={{textAlign:"right"}}>R4</span><span style={{textAlign:"right"}}>Total</span>
                    </div>
                    {[...liveScores]
                      .map(s=>({...s,tot:s.R1+s.R2+s.R3+s.R4}))
                      .sort((a,b)=>a.tot-b.tot)
                      .map((s,idx)=>{
                        const g=findGolferById(s.gId);
                        if(!g) return null;
                        const isInPool = draftedGolferIds.has(g.id);
                        const pos = idx+1;
                        return (
                          <div key={s.gId} className="lb-row" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px",cursor:"pointer",background:isInPool?"rgba(27,67,50,.04)":"transparent"}}
                            onClick={()=>{setPoolStatsPlayer(g);setPoolTab("stats");setPoolStatsTab("player");}}>
                            <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:pos===1?"var(--gold-pale)":pos===2?"#E2E8F0":pos===3?"#FEE2CC":isInPool?"rgba(27,67,50,.08)":"var(--cream-2)",color:pos<=3?["#7A5C00","#475569","#9A3412"][pos-1]:isInPool?"var(--forest)":"var(--muted)"}}>{pos}</div>
                            <div>
                              <p style={{fontWeight:isInPool?700:600,fontSize:14}}>{g.country} {g.name}{isInPool&&<span style={{marginLeft:6,fontSize:10,background:"var(--gold-pale)",color:"#7A5C00",padding:"1px 5px",borderRadius:3,fontWeight:700}}>IN POOL</span>}</p>
                              <p style={{fontSize:11,color:"var(--muted)"}}>#{g.rank} · {g.drivDist} yds</p>
                            </div>
                            {[s.R1,s.R2,s.R3,s.R4].map((v,i)=><div key={i} style={{textAlign:"right"}}>{fmtScore(v)}</div>)}
                            <div style={{textAlign:"right",fontSize:15}}>{fmtScore(s.tot)}</div>
                          </div>
                        );
                    })}
                  </div>
                )}

                {poolTab==="teams" && (
                  <div className="g2">
                    {poolStandings.map((p,i)=>{
                      const scores = p.team.map(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls?ls.R1+ls.R2+ls.R3+ls.R4:0;}).sort((a,b)=>a-b);
                      return (
                        <div key={p.id} className="card">
                          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
                            <Avatar init={p.avatar} color={i===0?"var(--gold)":"var(--forest)"} size={36}/>
                            <div style={{flex:1}}>
                              <p style={{fontWeight:700,fontSize:14}}>{p.name}</p>
                              <p style={{fontSize:12,color:"var(--muted)"}}>Rank #{i+1}</p>
                            </div>
                            <div style={{textAlign:"right"}}>
                              {fmtScore(p.score)}
                              <p style={{fontSize:11,color:"var(--muted)"}}>best {sc}</p>
                            </div>
                          </div>
                          {p.team.map((g,gi)=>{
                            const ls=liveScores.find(l=>l.gId===g.id);
                            const tot=ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                            const isCounting=tot!==null&&scores.indexOf(tot)<sc;
                            return (
                              <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--cream-2)",opacity:isCounting?1:0.5}}>
                                {isCounting&&<span style={{fontSize:10,background:"var(--gold-pale)",color:"#7A5C00",padding:"1px 5px",borderRadius:3,fontWeight:700,flexShrink:0}}>★</span>}
                                {!isCounting&&<span style={{width:19,flexShrink:0}}/>}
                                <p style={{fontSize:13,flex:1,fontWeight:isCounting?600:400,cursor:"pointer"}} onClick={()=>{setPoolStatsPlayer(g);setPoolTab("stats");setPoolStatsTab("player");}}>{g.country} {g.name}</p>
                                {tot!==null?fmtScore(tot):<span style={{fontSize:12,color:"var(--muted)"}}>—</span>}
                              </div>
                            );
                          })}
                          <div style={{marginTop:10,background:p.cutMade>=activePool.cutLine?"#DCFCE7":"#FEE2E2",borderRadius:7,padding:"7px 10px",display:"flex",justifyContent:"space-between",fontSize:12}}>
                            <span>{p.cutMade} made cut (need {activePool.cutLine})</span>
                            <span style={{fontWeight:700,color:p.cutMade>=activePool.cutLine?"var(--green)":"var(--red)"}}>{p.cutMade>=activePool.cutLine?"✓ Eligible":"✗ Out"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {poolTab==="chart" && (
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Pool Standings — Round by Round</h3>
                    <p className="sub" style={{marginBottom:18}}>Cumulative best-{sc} score progression (lower = better)</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{top:5,right:10,bottom:0,left:0}}
                        data={["R1","R2","R3","R4"].map((r,ri)=>({
                          round:r,
                          ...poolStandings.map(p=>({
                            [p.name.split(" ")[0]]:p.team.map(g=>{
                              const ls=liveScores.find(l=>l.gId===g.id);
                              if(!ls) return 0;
                              return [ls.R1,ls.R2,ls.R3,ls.R4].slice(0,ri+1).reduce((a,b)=>a+b,0);
                            }).sort((a,b)=>a-b).slice(0,sc).reduce((a,b)=>a+b,0)
                          })).reduce((a,b)=>({...a,...b}),{})
                        }))}>
                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                        <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                        <Tooltip content={<CTooltip/>}/>
                        {poolStandings.map((p,i)=>(
                          <Line key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} strokeWidth={2.5} dot={{r:4}} name={p.name.split(" ")[0]}/>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {poolTab==="prob" && (
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Win Probability</h3>
                    <p className="sub" style={{marginBottom:18}}>Simulated win % after each round based on team scores</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={[
                        {r:"Start",...Object.fromEntries(poolStandings.map((p,i)=>[p.name.split(" ")[0],Math.max(5,25-i*3)]))},
                        {r:"R1",   ...Object.fromEntries(poolStandings.map((p,i)=>[p.name.split(" ")[0],Math.max(3,28-i*4)]))},
                        {r:"R2",   ...Object.fromEntries(poolStandings.map((p,i)=>[p.name.split(" ")[0],Math.max(2,32-i*5)]))},
                        {r:"R3",   ...Object.fromEntries(poolStandings.map((p,i)=>[p.name.split(" ")[0],Math.max(1,36-i*6)]))},
                        {r:"R4",   ...Object.fromEntries(poolStandings.map((p,i)=>[p.name.split(" ")[0],Math.max(0,i===0?55:i===1?25:i===2?12:5)]))},
                      ]}>
                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                        <XAxis dataKey="r" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%"/>
                        <Tooltip content={<CTooltip/>}/>
                        {poolStandings.map((p,i)=>(
                          <Area key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} fill="none" strokeWidth={2} dot={{r:3}} name={p.name.split(" ")[0]}/>
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ── POOL STATISTICS TAB ── */}
                {poolTab==="stats" && (
                  <div>
                    <div style={{marginBottom:16}}>
                      <h3 className="h3" style={{marginBottom:4}}>Pool Statistics</h3>
                      <p className="sub">Stats for the {poolGolfers.length} golfers drafted in {activePool.name}</p>
                    </div>

                    <div className="tabs" style={{maxWidth:660,marginBottom:18}}>
                      {[["overview","📊 Overview"],["players","👤 All Players"],["player","🔍 Spotlight"],["compare","⚖️ Compare"]].map(([t,l])=>(
                        <button key={t} className={`tab ${poolStatsTab===t?"on":""}`} onClick={()=>setPoolStatsTab(t)}>{l}</button>
                      ))}
                    </div>

                    {poolStatsTab==="overview" && (
                      <div>
                        {(()=>{
                          // "Your team" = first participant (James) or current user's team
                          const myParticipant = joinedParticipants.find(p=>p.id===currentUser) || joinedParticipants[0];
                          const myTeam = getPoolTeam(myParticipant.id);
                          const myRank = poolStandings.findIndex(p=>p.id===myParticipant.id)+1;
                          const myScore = getPoolScore(myParticipant.id);
                          const myTeamScores = myTeam.map(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls?ls.R1+ls.R2+ls.R3+ls.R4:null;}).filter(x=>x!==null);
                          const myBirdies = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.birdies.reduce((a,b)=>a+b,0):0);},0);
                          const myEagles = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.eagles.reduce((a,b)=>a+b,0):0);},0);
                          const myBogeys = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.bogeys.reduce((a,b)=>a+b,0):0);},0);
                          const bestGolferScore = myTeamScores.length?Math.min(...myTeamScores):null;
                          const bestGolfer = myTeam.find(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls&&(ls.R1+ls.R2+ls.R3+ls.R4)===bestGolferScore;});
                          const allRounds = myTeam.flatMap(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls?[ls.R1,ls.R2,ls.R3,ls.R4]:[];});
                          const bestRound = allRounds.length?Math.min(...allRounds):null;
                          const sortedTeamScores = [...myTeamScores].sort((a,b)=>a-b);
                          const countingScore = sortedTeamScores.slice(0,sc).reduce((a,b)=>a+b,0);

                          return (
                            <div>
                              {/* Your team header */}
                              <div className="card" style={{marginBottom:20,background:"linear-gradient(135deg,var(--forest),var(--forest-mid))",color:"#fff"}}>
                                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                                  <Avatar init={myParticipant.avatar} size={48} color="var(--gold)"/>
                                  <div style={{flex:1}}>
                                    <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(255,255,255,.6)",marginBottom:3}}>Your Team</p>
                                    <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#fff",marginBottom:2}}>{myParticipant.name}</h3>
                                    <p style={{fontSize:13,color:"rgba(255,255,255,.7)"}}>{myTeam.map(g=>g.name.split(" ").pop()).join(" · ")}</p>
                                  </div>
                                  <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                                    <div style={{textAlign:"center"}}>
                                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"var(--gold)",lineHeight:1}}>{fmtScore(myScore)}</div>
                                      <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>Total (best {sc})</div>
                                    </div>
                                    <div style={{textAlign:"center"}}>
                                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"#fff",lineHeight:1}}>#{myRank}</div>
                                      <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>Pool Rank</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Stat pills — team-specific */}
                              <div className="g4" style={{marginBottom:20}}>
                                {[
                                  {n:fmtScore(bestGolferScore),l:"Best Golfer Score",sub:bestGolfer?.name.split(" ").pop()||"—"},
                                  {n:bestRound!==null?fmtScore(bestRound):"—",l:"Best Single Round",sub:"On your team"},
                                  {n:myBirdies,l:"Team Birdies",sub:"All 4 rounds"},
                                  {n:myEagles||myBogeys,l:myEagles?"Team Eagles":"Team Bogeys",sub:myEagles?"Across your team":"Total bogeys"},
                                ].map(s=>(
                                  <div key={s.l} className="card stat-pill" style={{textAlign:"left",padding:"18px 20px"}}>
                                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"var(--gold)",lineHeight:1}}>{s.n}</div>
                                    <div style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginTop:4}}>{s.l}</div>
                                    <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.sub}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Charts — your team only */}
                              <div className="g2">
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Your Team — Scoring Breakdown</h3>
                                  <p className="sub" style={{marginBottom:16}}>Eagles / Birdies / Pars / Bogeys per golfer</p>
                                  <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={myTeam.map(g=>{
                                      const s=liveScores.find(l=>l.gId===g.id);
                                      const b=s?s.birdies.reduce((a,b)=>a+b,0):0;
                                      const e=s?s.eagles.reduce((a,b)=>a+b,0):0;
                                      const bog=s?s.bogeys.reduce((a,b)=>a+b,0):0;
                                      return {name:g.name.split(" ").pop(),eagles:e,birdies:b,pars:72-b-e-bog,bogeys:bog};
                                    })} margin={{top:0,right:10,bottom:0,left:0}}>
                                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                      <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <Tooltip content={<CTooltip/>}/>
                                      <Bar dataKey="eagles" stackId="a" fill="#7C3AED" name="Eagles"/>
                                      <Bar dataKey="birdies" stackId="a" fill="#40916C" name="Birdies"/>
                                      <Bar dataKey="pars" stackId="a" fill="#D4C5A0" name="Pars"/>
                                      <Bar dataKey="bogeys" stackId="a" fill="#EF4444" radius={[3,3,0,0]} name="Bogeys"/>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Your Team — Round by Round</h3>
                                  <p className="sub" style={{marginBottom:16}}>Cumulative score per golfer on your team</p>
                                  <ResponsiveContainer width="100%" height={220}>
                                    <LineChart margin={{top:5,right:10,bottom:0,left:0}}
                                      data={["R1","R2","R3","R4"].map((r,ri)=>({
                                        round:r,
                                        ...myTeam.reduce((acc,g)=>{
                                          const ls=liveScores.find(l=>l.gId===g.id);
                                          if(!ls) return acc;
                                          acc[g.name.split(" ").pop()]=[ls.R1,ls.R2,ls.R3,ls.R4].slice(0,ri+1).reduce((a,b)=>a+b,0);
                                          return acc;
                                        },{})
                                      }))}>
                                      <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                                      <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                                      <Tooltip content={<CTooltip/>}/>
                                      {myTeam.map((g,i)=>(
                                        <Line key={g.id} type="monotone" dataKey={g.name.split(" ").pop()} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84"][i%4]} strokeWidth={2.5} dot={{r:4}} name={g.name.split(" ").pop()}/>
                                      ))}
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Each golfer on your team — individual round breakdown */}
                              <div style={{marginTop:20}}>
                                <h3 className="h3" style={{marginBottom:14}}>Your Golfers — Detailed</h3>
                                <div className="g2">
                                  {myTeam.map((g,gi)=>{
                                    const ls=liveScores.find(l=>l.gId===g.id);
                                    const tot=ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                                    const sortedScores=[...myTeamScores].sort((a,b)=>a-b);
                                    const isCounting=tot!==null&&sortedScores.indexOf(tot)<sc;
                                    const tourneyPos=[...liveScores].map(s=>({...s,tot:s.R1+s.R2+s.R3+s.R4})).sort((a,b)=>a.tot-b.tot).findIndex(s=>s.gId===g.id)+1;
                                    return (
                                      <div key={g.id} className="card" style={{border:isCounting?"2px solid var(--gold)":"1px solid rgba(27,67,50,.06)"}}>
                                        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                                          <Avatar init={g.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={36} color={isCounting?"var(--gold)":"var(--forest)"}/>
                                          <div style={{flex:1}}>
                                            <p style={{fontWeight:700,fontSize:14}}>{g.country} {g.name}</p>
                                            <p style={{fontSize:11,color:"var(--muted)"}}>T{tourneyPos} in tournament · #{g.rank} world</p>
                                          </div>
                                          <div style={{textAlign:"right"}}>
                                            {fmtScore(tot)}
                                            {isCounting&&<p style={{fontSize:10,color:"var(--gold)",fontWeight:700}}>★ Counting</p>}
                                          </div>
                                        </div>
                                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                                          {ls&&[ls.R1,ls.R2,ls.R3,ls.R4].map((v,ri)=>(
                                            <div key={ri} style={{textAlign:"center",background:"var(--cream)",borderRadius:7,padding:"6px 0"}}>
                                              <p style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>R{ri+1}</p>
                                              <div style={{fontSize:14,fontWeight:700}}>{fmtScore(v)}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {poolStatsTab==="players" && (
                      <div className="card" style={{padding:0,overflow:"hidden"}}>
                        <div className="lb-row lb-hdr" style={{gridTemplateColumns:"36px 1fr 60px 60px 60px 60px 70px"}}>
                          <span>#</span><span>Player</span><span style={{textAlign:"right"}}>R1</span><span style={{textAlign:"right"}}>R2</span><span style={{textAlign:"right"}}>R3</span><span style={{textAlign:"right"}}>R4</span><span style={{textAlign:"right"}}>Total</span>
                        </div>
                        {[...poolTournamentField].sort((a,b)=>{
                          const lsa=liveScores.find(l=>l.gId===a.id);
                          const lsb=liveScores.find(l=>l.gId===b.id);
                          const ta=lsa?lsa.R1+lsa.R2+lsa.R3+lsa.R4:999;
                          const tb=lsb?lsb.R1+lsb.R2+lsb.R3+lsb.R4:999;
                          return ta-tb;
                        }).map((g,idx)=>{
                          const ls=liveScores.find(l=>l.gId===g.id);
                          const tot=ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                          const isInPool=draftedGolferIds.has(g.id);
                          const pick=poolPicks.find(p=>p.golferId===g.id);
                          const drafter=joinedParticipants.find(p=>p.id===pick?.participantId);
                          return (
                            <div key={g.id} className="lb-row" style={{gridTemplateColumns:"36px 1fr 60px 60px 60px 60px 70px",cursor:"pointer",background:isInPool?"rgba(27,67,50,.03)":"transparent"}} onClick={()=>{setPoolStatsPlayer(g);setPoolStatsTab("player");}}>
                              <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:idx===0?"var(--gold-pale)":idx===1?"#E2E8F0":idx===2?"#FEE2CC":isInPool?"rgba(27,67,50,.08)":"var(--cream-2)",color:idx<3?["#7A5C00","#475569","#9A3412"][idx]:isInPool?"var(--forest)":"var(--muted)"}}>{idx+1}</div>
                              <div>
                                <p style={{fontWeight:isInPool?700:600,fontSize:14}}>{g.country} {g.name}{isInPool&&<span style={{marginLeft:6,fontSize:10,background:"var(--gold-pale)",color:"#7A5C00",padding:"1px 5px",borderRadius:3,fontWeight:700}}>★ {drafter?.name?.split(" ")[0]||"Pool"}</span>}</p>
                                <p style={{fontSize:11,color:"var(--muted)"}}>#{g.rank} · {g.drivDist} yds · SG {g.sg>0?"+":""}{g.sg}</p>
                              </div>
                              {ls?[ls.R1,ls.R2,ls.R3,ls.R4].map((v,i)=><div key={i} style={{textAlign:"right"}}>{fmtScore(v)}</div>):[null,null,null,null].map((_,i)=><div key={i} style={{textAlign:"right",color:"var(--muted)"}}>—</div>)}
                              <div style={{textAlign:"right",fontSize:15}}>{tot!==null?fmtScore(tot):"—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {poolStatsTab==="player" && (
                      <div>
                        {/* Search / filter bar */}
                        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
                          <div className="search-wrap" style={{flex:1,minWidth:200,margin:0}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input className="inp search-inp" placeholder="Search players…"
                              value={search} onChange={e=>setSearch(e.target.value)}
                              style={{padding:"8px 12px 8px 32px",fontSize:13}}/>
                          </div>
                          {search&&<button className="btn btn-ghost btn-sm" onClick={()=>setSearch("")}>Clear</button>}
                          <span style={{fontSize:12,color:"var(--muted)",whiteSpace:"nowrap"}}>{poolTournamentField.filter(g=>g.name.toLowerCase().includes(search.toLowerCase())).length} players</span>
                        </div>
                        {/* Player grid */}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18,maxHeight:160,overflowY:"auto",padding:"4px 0"}}>
                          {poolTournamentField
                            .filter(g=>g.name.toLowerCase().includes(search.toLowerCase()))
                            .map(g=>{
                              const isInPool = draftedGolferIds.has(g.id);
                              return (
                                <button key={g.id}
                                  className={`btn btn-sm ${poolStatsPlayer?.id===g.id?"btn-prim":""}`}
                                  style={poolStatsPlayer?.id!==g.id?{background:isInPool?"rgba(27,67,50,.1)":"rgba(27,67,50,.04)",color:isInPool?"var(--forest)":"var(--muted)",border:isInPool?"1px solid rgba(27,67,50,.2)":"1px solid transparent"}:{}}
                                  onClick={()=>setPoolStatsPlayer(g)}>
                                  {isInPool&&<span style={{color:"var(--gold)",marginRight:3,fontSize:9}}>★</span>}
                                  {g.name.split(" ").pop()}
                                </button>
                              );
                          })}
                        </div>
                        <p style={{fontSize:11,color:"var(--muted)",marginBottom:16}}>
                          <span style={{color:"var(--gold)"}}>★</span> = drafted in this pool
                        </p>
                        {poolStatsPlayer && (()=>{
                          const rounds = getPlayerRounds(poolStatsPlayer.id);
                          const sg = getSGData(poolStatsPlayer.id);
                          const ls = liveScores.find(l=>l.gId===poolStatsPlayer.id);
                          const tot = ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                          const pick = poolPicks.find(p=>p.golferId===poolStatsPlayer.id);
                          const drafter = joinedParticipants.find(p=>p.id===pick?.participantId);
                          const isInPool = draftedGolferIds.has(poolStatsPlayer.id);
                          return (
                            <div>
                              <div className="card" style={{marginBottom:20}}>
                                <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                                  <Avatar init={poolStatsPlayer.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={56} color="var(--forest)"/>
                                  <div style={{flex:1}}>
                                    <h2 className="h2">{poolStatsPlayer.country} {poolStatsPlayer.name}</h2>
                                    <p className="sub">World Rank #{poolStatsPlayer.rank} · Avg {poolStatsPlayer.avg} · SG {poolStatsPlayer.sg>0?"+":""}{poolStatsPlayer.sg}</p>
                                    <p style={{fontSize:12,marginTop:4}}>
                                      {isInPool
                                        ? <span style={{color:"var(--forest-mid)",fontWeight:600}}>★ Drafted by: {drafter?.name||"—"}</span>
                                        : <span style={{color:"var(--muted)"}}>Not drafted in this pool</span>
                                      }
                                    </p>
                                  </div>
                                  <div style={{display:"flex",gap:14}}>
                                    {[["Total",fmtScore(tot)],["Drive",`${poolStatsPlayer.drivDist} yds`],["GIR",`${poolStatsPlayer.gir}%`]].map(([l,v])=>(
                                      <div key={l} className="stat-pill">
                                        <div className="stat-pill-n">{v}</div>
                                        <div className="stat-pill-l">{l}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="g2" style={{marginBottom:18}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Round Scores</h3>
                                  <p className="sub" style={{marginBottom:16}}>Score to par each round</p>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={rounds} margin={{top:10,right:10,bottom:0,left:0}} barCategoryGap="30%">
                                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                      <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <YAxis
                                        tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}
                                        tickFormatter={v=>v>0?`+${v}`:v===0?"E":v}
                                        domain={[dataMin=>Math.min(dataMin-1,-1), dataMax=>Math.max(dataMax+1,1)]}
                                      />
                                      <Tooltip formatter={(v,n)=>[v>0?`+${v}`:v===0?"E":v,"Score"]} labelFormatter={l=>l}/>
                                      <ReferenceLine y={0} stroke="var(--parchment)" strokeWidth={1.5}/>
                                      <Bar dataKey="score" name="Score" maxBarSize={48}>
                                        {rounds.map((r,i)=>(
                                          <Cell key={i} fill={r.score<=-5?"#1B4332":r.score<=-3?"#2D6A4F":r.score<0?"#74C69D":r.score===0?"#D4C5A0":r.score<=2?"#F97316":"#EF4444"} radius={r.score<0?[0,0,4,4]:[4,4,0,0]}/>
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                                {sg.length>0&&(
                                  <div className="card">
                                    <h3 className="h3" style={{marginBottom:4}}>Strokes Gained</h3>
                                    <p className="sub" style={{marginBottom:16}}>SG breakdown by category</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                      <RadarChart data={sg} margin={{top:10,right:10,bottom:10,left:10}}>
                                        <PolarGrid stroke="var(--parchment)"/>
                                        <PolarAngleAxis dataKey="stat" tick={{fontSize:10,fill:"#78716C"}}/>
                                        <PolarRadiusAxis angle={30} domain={[-0.5,2]} tick={{fontSize:8,fill:"#CBD5E1"}} tickCount={4}/>
                                        <Radar dataKey="value" stroke="var(--forest)" fill="var(--forest)" fillOpacity={0.2} strokeWidth={2}/>
                                        <Tooltip content={<CTooltip/>}/>
                                      </RadarChart>
                                    </ResponsiveContainer>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        {!poolStatsPlayer&&<div style={{textAlign:"center",padding:"60px 40px",color:"var(--muted)"}}>Select a player above to view their stats</div>}
                      </div>
                    )}

                    {poolStatsTab==="compare" && (
                      <div>
                        {/* Player pickers */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"start",marginBottom:20}}>
                          {[{sel:compareA,setSel:setCompareA,label:"Player A",color:"#1B4332"},{sel:compareB,setSel:setCompareB,label:"Player B",color:"#C8A94F"}].map(({sel,setSel,label,color},pi)=>(
                            <div key={pi}>
                              <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".8px",color,marginBottom:8}}>{label}</p>
                              {sel ? (
                                <div style={{background:"var(--cream)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,border:`2px solid ${color}`}}>
                                  <Avatar init={sel.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={32} color={color}/>
                                  <div style={{flex:1}}>
                                    <p style={{fontWeight:700,fontSize:13}}>{sel.name}</p>
                                    <p style={{fontSize:11,color:"var(--muted)"}}>#{sel.rank} · {draftedGolferIds.has(sel.id)?"★ In pool":"Not in pool"}</p>
                                  </div>
                                  <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:16,cursor:"pointer",padding:"0 2px"}}>×</button>
                                </div>
                              ) : (
                                <div style={{background:"var(--cream-2)",borderRadius:10,padding:"10px 14px",border:`2px dashed ${color}40`,color:"var(--muted)",fontSize:13,textAlign:"center"}}>
                                  Choose a player ↓
                                </div>
                              )}
                            </div>
                          ))}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"center",paddingTop:28}}>
                            <span style={{fontSize:22,fontWeight:800,color:"var(--muted)"}}>vs</span>
                          </div>
                        </div>

                        {/* Search to pick players */}
                        <div style={{marginBottom:16}}>
                          <div className="search-wrap" style={{marginBottom:8}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#78716C" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <input className="inp search-inp" placeholder="Search players to compare…"
                              value={compareSearch} onChange={e=>setCompareSearch(e.target.value)}
                              style={{fontSize:13,padding:"8px 12px 8px 32px"}}/>
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",maxHeight:130,overflowY:"auto",padding:"2px 0"}}>
                            {poolTournamentField
                              .filter(g=>g.name.toLowerCase().includes(compareSearch.toLowerCase()))
                              .map(g=>{
                                const isA=compareA?.id===g.id, isB=compareB?.id===g.id;
                                const inPool=draftedGolferIds.has(g.id);
                                return (
                                  <button key={g.id}
                                    onClick={()=>{
                                      if(isA){setCompareA(null);}
                                      else if(isB){setCompareB(null);}
                                      else if(!compareA){setCompareA(g);}
                                      else if(!compareB){setCompareB(g);}
                                      else{setCompareA(g);}
                                    }}
                                    style={{padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:isA||isB?700:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                                      background:isA?"#1B4332":isB?"#C8A94F":inPool?"rgba(27,67,50,.08)":"transparent",
                                      color:isA?"#fff":isB?"#fff":inPool?"var(--forest)":"var(--muted)",
                                      border:`1px solid ${isA?"#1B4332":isB?"#C8A94F":inPool?"rgba(27,67,50,.2)":"var(--parchment)"}`,
                                      transition:"all .12s"}}>
                                    {inPool&&!isA&&!isB&&<span style={{color:"var(--gold)",marginRight:3,fontSize:9}}>★</span>}
                                    {g.name.split(" ").pop()}
                                  </button>
                                );
                              })}
                          </div>
                          <p style={{fontSize:11,color:"var(--muted)",marginTop:6}}>Tap once to set Player A · twice to set Player B · ★ = in pool</p>
                        </div>

                        {/* Head-to-head comparison */}
                        {compareA && compareB ? (()=>{
                          const lsA=liveScores.find(l=>l.gId===compareA.id);
                          const lsB=liveScores.find(l=>l.gId===compareB.id);
                          const totA=lsA?lsA.R1+lsA.R2+lsA.R3+lsA.R4:null;
                          const totB=lsB?lsB.R1+lsB.R2+lsB.R3+lsB.R4:null;
                          const rounds=["R1","R2","R3","R4"].map((r,ri)=>({
                            round:r,
                            [compareA.name.split(" ").pop()]:lsA?lsA[r]:0,
                            [compareB.name.split(" ").pop()]:lsB?lsB[r]:0,
                          }));
                          const sgA=SG_DATA[compareA.id], sgB=SG_DATA[compareB.id];
                          const statRows=[
                            {l:"Total Score",a:totA!==null?fmtScore(totA):"—",b:totB!==null?fmtScore(totB):"—",win:totA!==null&&totB!==null?(totA<totB?"a":totA>totB?"b":"e"):null},
                            {l:"World Rank",a:`#${compareA.rank}`,b:`#${compareB.rank}`,win:compareA.rank<compareB.rank?"a":compareA.rank>compareB.rank?"b":"e"},
                            {l:"Scoring Avg",a:compareA.avg,b:compareB.avg,win:compareA.avg<compareB.avg?"a":compareA.avg>compareB.avg?"b":"e"},
                            {l:"SG Total",a:compareA.sg>0?`+${compareA.sg}`:compareA.sg,b:compareB.sg>0?`+${compareB.sg}`:compareB.sg,win:compareA.sg>compareB.sg?"a":compareA.sg<compareB.sg?"b":"e"},
                            {l:"Drive Dist",a:`${compareA.drivDist} yds`,b:`${compareB.drivDist} yds`,win:compareA.drivDist>compareB.drivDist?"a":compareA.drivDist<compareB.drivDist?"b":"e"},
                            {l:"GIR %",a:`${compareA.gir}%`,b:`${compareB.gir}%`,win:compareA.gir>compareB.gir?"a":compareA.gir<compareB.gir?"b":"e"},
                            ...(lsA&&lsB?[
                              {l:"Birdies",a:lsA.birdies.reduce((x,y)=>x+y,0),b:lsB.birdies.reduce((x,y)=>x+y,0),win:lsA.birdies.reduce((x,y)=>x+y,0)>lsB.birdies.reduce((x,y)=>x+y,0)?"a":"b"},
                              {l:"Eagles",a:lsA.eagles.reduce((x,y)=>x+y,0),b:lsB.eagles.reduce((x,y)=>x+y,0),win:lsA.eagles.reduce((x,y)=>x+y,0)>lsB.eagles.reduce((x,y)=>x+y,0)?"a":"b"},
                              {l:"Bogeys",a:lsA.bogeys.reduce((x,y)=>x+y,0),b:lsB.bogeys.reduce((x,y)=>x+y,0),win:lsA.bogeys.reduce((x,y)=>x+y,0)<lsB.bogeys.reduce((x,y)=>x+y,0)?"a":"b"},
                            ]:[]),
                          ];
                          return (
                            <div>
                              {/* Stat comparison table */}
                              <div className="card" style={{padding:0,overflow:"hidden",marginBottom:16}}>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",background:"var(--forest)",padding:"10px 16px"}}>
                                  <p style={{fontSize:12,fontWeight:700,color:"#fff"}}>{compareA.name.split(" ").pop()}</p>
                                  <p style={{fontSize:11,color:"rgba(255,255,255,.5)",textAlign:"center"}}>stat</p>
                                  <p style={{fontSize:12,fontWeight:700,color:"var(--gold)",textAlign:"right"}}>{compareB.name.split(" ").pop()}</p>
                                </div>
                                {statRows.map((row,i)=>(
                                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",padding:"10px 16px",borderBottom:"1px solid var(--cream-2)",background:i%2===0?"#fff":"var(--cream)"}}>
                                    <span style={{fontSize:14,fontWeight:row.win==="a"?700:400,color:row.win==="a"?"var(--forest)":"var(--text)"}}>{row.a}{row.win==="a"&&<span style={{marginLeft:5,fontSize:10,color:"var(--forest)"}}>▲</span>}</span>
                                    <span style={{fontSize:11,color:"var(--muted)",textAlign:"center",alignSelf:"center"}}>{row.l}</span>
                                    <span style={{fontSize:14,fontWeight:row.win==="b"?700:400,color:row.win==="b"?"var(--gold)":"var(--text)",textAlign:"right"}}>{row.win==="b"&&<span style={{marginRight:5,fontSize:10,color:"var(--gold)"}}>▲</span>}{row.b}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Round-by-round chart */}
                              <div className="card">
                                <h3 className="h3" style={{marginBottom:4}}>Round by Round</h3>
                                <p className="sub" style={{marginBottom:16}}>Score to par each round</p>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={rounds} margin={{top:10,right:10,bottom:0,left:0}} barCategoryGap="25%">
                                    <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                    <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v===0?"E":v}
                                      domain={[dataMin=>Math.min(dataMin-1,-1),dataMax=>Math.max(dataMax+1,1)]}/>
                                    <Tooltip formatter={(v)=>[v>0?`+${v}`:v===0?"E":v,"Score"]}/>
                                    <ReferenceLine y={0} stroke="var(--parchment)" strokeWidth={1.5}/>
                                    <Legend wrapperStyle={{fontSize:11}}/>
                                    <Bar dataKey={compareA.name.split(" ").pop()} fill="#1B4332" radius={[3,3,0,0]} maxBarSize={32}/>
                                    <Bar dataKey={compareB.name.split(" ").pop()} fill="#C8A94F" radius={[3,3,0,0]} maxBarSize={32}/>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })() : (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"var(--muted)"}}>
                            <p style={{fontSize:32,marginBottom:8}}>⚖️</p>
                            <p style={{fontSize:14,fontWeight:600}}>Select two players above to compare</p>
                            <p style={{fontSize:12,marginTop:4}}>Choose from the full tournament field</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        )}

        {/* ──────── ADMIN (Create/Edit Pool) ──────── */}
        {view==="admin" && (
          <div className="page">
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setView("home")}>← My Pools</button>
              <div>
                <h2 className="h2">Create New Pool</h2>
                <p className="sub">Configure your pool, then invite participants via a single shareable link.</p>
              </div>
            </div>
            <div className="tabs" style={{maxWidth:540}}>
              {[["config","⚙️ Config"],["participants","👥 Roster"],["links","🔗 Invite Link"]].map(([t,l])=>(
                <button key={t} className={`tab ${adminTab===t?"on":""}`} onClick={()=>setAdminTab(t)}>{l}</button>
              ))}
            </div>

            {adminTab==="config" && (
              <div className="g2" style={{maxWidth:920}}>
                <div className="card">
                  <h3 className="h3" style={{marginBottom:18}}>Pool Settings</h3>
                  <div className="fgrp">
                    <label className="label">Pool Name</label>
                    <input className="inp" value={config.poolName} onChange={e=>setConfig(c=>({...c,poolName:e.target.value}))} placeholder="My Golf Pool"/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Tournament</label>
                    <select className="inp" value={config.tournament} onChange={e=>setConfig(c=>({...c,tournament:e.target.value}))}>
                      <option value="">— Select Future Tournament —</option>
                      {tournaments.map(t=><option key={t.id} value={t.id}>{t.name} · {t.date}</option>)}
                    </select>
                  </div>
                  {config.tournament && (()=>{
                    const t=tournaments.find(x=>x.id===config.tournament);
                    return (
                      <div style={{background:"rgba(27,67,50,.05)",borderRadius:10,padding:"11px 14px",marginBottom:16,border:"1px solid rgba(27,67,50,.08)"}}>
                        <p style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginBottom:3}}>{t.name}</p>
                        <p style={{fontSize:12,color:"var(--muted)"}}>{t.venue} · {t.date} · {t.purse} purse · <strong>{Math.min(t.field,FULL_FIELD.length)} players</strong></p>
                        {tournamentCourse && (
                          <p style={{fontSize:12,color:"var(--muted)",marginTop:5}}>
                            Course API: <strong>{tournamentCourse.name}</strong>
                            {tournamentCourse.location ? ` · ${tournamentCourse.location}` : ""}
                            {tournamentCourse.par ? ` · Par ${tournamentCourse.par}` : ""}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="fgrp">
                    <label className="label">Max Participants</label>
                    <select className="inp" value={config.maxParticipants} onChange={e=>setConfig(c=>({...c,maxParticipants:+e.target.value}))}>
                      {[4,6,8,10,12,16,20].map(n=><option key={n} value={n}>{n} participants</option>)}
                    </select>
                  </div>
                  <div className="fgrp">
                    <label className="label">Golfers Per Team</label>
                    <select className="inp" value={config.teamSize} onChange={e=>setConfig(c=>({...c,teamSize:+e.target.value,scoringGolfers:Math.min(config.scoringGolfers,+e.target.value)}))}>
                      {[2,3,4,5,6].map(n=><option key={n} value={n}>{n} golfers per team</option>)}
                    </select>
                  </div>
                </div>
                <div className="card">
                  <h3 className="h3" style={{marginBottom:18}}>Scoring Rules</h3>
                  <div className="fgrp">
                    <label className="label">Scoring Golfers</label>
                    <select className="inp" value={config.scoringGolfers} onChange={e=>setConfig(c=>({...c,scoringGolfers:+e.target.value}))}>
                      {[...Array(config.teamSize).keys()].map(i=>i+1).map(n=>(
                        <option key={n} value={n}>Best {n} of {config.teamSize}{n===config.teamSize?" (all)":""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fgrp">
                    <label className="label">Cut Line</label>
                    <select className="inp" value={config.cutLine} onChange={e=>setConfig(c=>({...c,cutLine:+e.target.value}))}>
                      {[1,2,3,4].map(n=><option key={n} value={n}>Min {n} golfer{n>1?"s":""} must make cut</option>)}
                    </select>
                  </div>
                  <div className="fgrp">
                    <label className="label">Shot Clock</label>
                    <select className="inp" value={config.shotClock} onChange={e=>setConfig(c=>({...c,shotClock:+e.target.value}))}>
                      {[30,45,60,90,120].map(n=><option key={n} value={n}>{n} seconds per pick</option>)}
                    </select>
                  </div>
                  <div className="fgrp">
                    <label className="label">Draft Order</label>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      {[
                        {val:"ordered",icon:"🔢",title:"Ordered",desc:"Players pick in lobby join order"},
                        {val:"random",icon:"🎲",title:"Random",desc:"Order is randomly shuffled at draft start"},
                      ].map(opt=>(
                        <div key={opt.val} onClick={()=>setConfig(c=>({...c,draftOrderType:opt.val}))}
                          style={{border:`2px solid ${config.draftOrderType===opt.val?"var(--forest)":"var(--parchment)"}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",background:config.draftOrderType===opt.val?"rgba(27,67,50,.05)":"#fff",transition:"all .15s"}}>
                          <p style={{fontSize:18,marginBottom:4}}>{opt.icon}</p>
                          <p style={{fontSize:13,fontWeight:700,color:"var(--forest)",marginBottom:2}}>{opt.title}</p>
                          <p style={{fontSize:11,color:"var(--muted)",lineHeight:1.4}}>{opt.desc}</p>
                          {config.draftOrderType===opt.val&&<p style={{fontSize:10,color:"var(--forest)",fontWeight:700,marginTop:6}}>✓ Selected</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{background:"var(--cream-2)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
                    {[["Tournament",tournaments.find(t=>t.id===config.tournament)?.name||"Not selected"],
                      ["Total Picks",`${config.maxParticipants*config.teamSize}`],
                      ["Scoring",`Best ${config.scoringGolfers} of ${config.teamSize}`],
                      ["Draft Order",config.draftOrderType==="random"?"🎲 Random":"🔢 Ordered"],
                    ].map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                        <span style={{color:"var(--muted)"}}>{k}</span>
                        <span style={{fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-prim" style={{width:"100%",justifyContent:"center"}} onClick={()=>{
                    const newPool = {
                      id:`p${Date.now()}`,
                      name:config.poolName,
                      tournamentId:config.tournament,
                      status:"lobby",
                      participants:0,
                      maxParticipants:config.maxParticipants,
                      teamSize:config.teamSize,
                      scoringGolfers:config.scoringGolfers,
                      cutLine:config.cutLine,
                      shotClock:config.shotClock,
                      draftOrderType:config.draftOrderType,
                      yourRank:null,yourScore:null,
                      hostId: currentUser||1,
                      created: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})
                    };
                    setPools(p=>[...p,newPool]);
                    setActivePool(newPool);
                    setPoolPhase("lobby");
                    setPoolReadyMap({});
                    setConfirmDelete(false);
                    setView("pool");
                    notify("Pool created! Share the invite link to get people in.");
                  }}>
                    💾 Save & Create Pool
                  </button>
                </div>
              </div>
            )}

            {adminTab==="participants" && (
              <div style={{maxWidth:680}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:600}}>{participants.filter(p=>p.joined).length}/{config.maxParticipants} joined</p>
                    <div className="prog-bar" style={{width:200,marginTop:6}}><div className="prog-fill" style={{width:`${(participants.filter(p=>p.joined).length/config.maxParticipants)*100}%`}}/></div>
                  </div>
                </div>
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  {participants.map((p,i)=>(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 18px",borderBottom:i<participants.length-1?"1px solid var(--cream-2)":"none"}}>
                      <Avatar init={p.avatar} color={p.joined?"var(--forest)":"#CBD5E1"} size={36}/>
                      <div style={{flex:1}}>
                        <p style={{fontWeight:600,fontSize:14}}>{p.name}</p>
                        <p style={{fontSize:12,color:"var(--muted)"}}>{p.email}</p>
                      </div>
                      <span className={`badge ${p.joined?"bg-forest":"bg-gold"}`}>{p.joined?"Joined":"Pending"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab==="links" && (
              <div style={{maxWidth:660}}>
                <div className="card" style={{marginBottom:16,border:"2px solid var(--gold-pale)"}}>
                  <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:18}}>
                    <span style={{fontSize:32}}>🔗</span>
                    <div>
                      <h3 className="h3" style={{marginBottom:4}}>One Shareable Invite Link</h3>
                      <p className="sub" style={{fontSize:13}}>Send this single link to everyone. They can log in to an existing account or create a new one — then they'll be automatically added to your pool.</p>
                    </div>
                  </div>
                  <div className="link-box" style={{marginBottom:16}}>
                    <span className="link-txt">mygolfpoolpro.com/join/pool_{config.poolName.toLowerCase().replace(/\s+/g,"_")}</span>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>copyLink(`https://mygolfpoolpro.com/join/pool_${config.poolName.toLowerCase().replace(/\s+/g,"_")}`)}>📋 Copy</button>
                      <button className="btn btn-prim btn-sm" onClick={()=>openInvite(null)}>👁️ Preview</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {["📧 Email invite","💬 Copy for text","🐦 Share link"].map(l=>(
                      <button key={l} className="btn btn-ghost btn-sm" onClick={()=>copyLink(`https://mygolfpoolpro.com/join/pool_${config.poolName.toLowerCase().replace(/\s+/g,"_")}`)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3 className="h3" style={{marginBottom:6}}>How It Works</h3>
                  <p className="sub" style={{marginBottom:14,fontSize:13}}>When someone clicks your invite link, they'll see a page where they can:</p>
                  {[
                    ["🔐","Log in to an existing account","Returning players are immediately added to your pool"],
                    ["✨","Create a new account","New players sign up with name, email & password"],
                    ["🔑","Reset their password","Forgot password link sends a reset email"],
                  ].map(([i,t,d])=>(
                    <div key={t} style={{display:"flex",gap:12,marginBottom:12,padding:"10px 14px",background:"var(--cream)",borderRadius:10}}>
                      <span style={{fontSize:20,flexShrink:0}}>{i}</span>
                      <div>
                        <p style={{fontWeight:600,fontSize:13}}>{t}</p>
                        <p style={{fontSize:12,color:"var(--muted)"}}>{d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────── INVITE / AUTH PAGE ──────── */}
        {view==="invite" && (
          <div className="portal-wrap">
            <div className="portal-card fade-up">
              <div style={{textAlign:"center",marginBottom:24}}>
                <div className="logo" style={{fontSize:22,display:"inline-block",marginBottom:12}}>My<em style={{color:"var(--text)"}}>Golf</em><span style={{color:"var(--gold)"}}>PoolPro</span></div>
                {invitePool && (
                  <div style={{background:"var(--forest)",borderRadius:12,padding:"16px 20px",color:"#fff",marginBottom:0}}>
                    <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(255,255,255,.55)",marginBottom:4}}>You've been invited to</p>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>{invitePool.name}</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{tournaments.find(t=>t.id===invitePool.tournamentId)?.name}</p>
                  </div>
                )}
                {!invitePool && (
                  <p style={{fontSize:14,color:"var(--muted)"}}>Sign in or create an account to join golf pools</p>
                )}
              </div>

              {authMode!=="forgot" && (
                <div className="auth-tabs">
                  <button className={`auth-tab ${authMode==="login"?"on":""}`} onClick={()=>{setAuthMode("login");setAuthError("");setAuthSuccess("");}}>Log In</button>
                  <button className={`auth-tab ${authMode==="signup"?"on":""}`} onClick={()=>{setAuthMode("signup");setAuthError("");setAuthSuccess("");}}>Create Account</button>
                </div>
              )}

              {authMode==="login" && (
                <div>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input className="inp" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Password</label>
                    <input className="inp" type="password" placeholder="Your password" value={authPass} onChange={e=>{setAuthPass(e.target.value);setAuthError("");}}/>
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  <button className="btn btn-gold" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:14}} onClick={handleLogin}>
                    Log In & Join Pool →
                  </button>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <button className="btn-link" style={{fontSize:13}} onClick={()=>{setAuthMode("forgot");setAuthError("");setForgotSent(false);}}>
                      Forgot your password?
                    </button>
                    {currentUser && (
                      <button className="btn-link" style={{fontSize:13}} onClick={()=>{setView("home");setActivePool(null);}}>
                        Back to Home
                      </button>
                    )}
                  </div>
                </div>
              )}

              {authMode==="signup" && (
                <div>
                  <div className="fgrp">
                    <label className="label">Full Name</label>
                    <input className="inp" placeholder="Your full name" value={authName} onChange={e=>{setAuthName(e.target.value);setAuthError("");}}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input className="inp" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Create Password</label>
                    <input className="inp" type="password" placeholder="Min. 6 characters" value={authPass} onChange={e=>{setAuthPass(e.target.value);setAuthError("");}}/>
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  <button className="btn btn-gold" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:12}} onClick={handleSignup}>
                    Create Account & Join →
                  </button>
                  <p style={{fontSize:11,color:"var(--muted)",textAlign:"center",lineHeight:1.5}}>
                    By creating an account you agree to our Terms of Service and Privacy Policy.
                  </p>
                  {currentUser && (
                    <div style={{marginTop:14,textAlign:"center"}}>
                      <button className="btn-link" onClick={()=>{setView("home");setActivePool(null);}}>Back to Home</button>
                    </div>
                  )}
                </div>
              )}

              {authMode==="forgot" && (
                <div>
                  <button className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setAuthMode("login")}>← Back to Login</button>
                  <h3 className="h3" style={{marginBottom:6}}>Reset Your Password</h3>
                  <p className="sub" style={{marginBottom:20,fontSize:13}}>Enter your email address and we'll send you a link to reset your password.</p>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input className="inp" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}}/>
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  {forgotSent ? (
                    <div style={{background:"#DCFCE7",borderRadius:10,padding:"14px 16px",display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
                      <span style={{fontSize:20}}>✅</span>
                      <div>
                        <p style={{fontWeight:700,color:"var(--green)",fontSize:14}}>Check your inbox!</p>
                        <p style={{fontSize:12,color:"#166534"}}>Password reset link sent to {authEmail}</p>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-prim" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:12}} onClick={handleForgotPassword}>
                      Send Reset Link
                    </button>
                  )}
                  <div style={{textAlign:"center"}}>
                    <button className="btn-link" onClick={()=>setAuthMode("login")}>Return to login</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────── ANALYTICS (Global / standalone view) ──────── */}
        {view==="analytics" && (
          <div className="page">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <h2 className="h2">The Masters Pool 2026</h2>
                  <span className="badge bg-red"><span className="live-dot"/>Live</span>
                </div>
                <p className="sub">Masters Tournament · Round 4 in progress · Scoring: Best 2 of 4</p>
              </div>
              <div style={{display:"flex",gap:10}}>
                <div className="update-bar" style={{margin:0}}>
                  <div className="pulse-dot"/>
                  <span>Refreshing in {countdown}s</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setView("stats")}>📈 Deep Stats →</button>
              </div>
            </div>

            {/* Pool standings cards */}
            <div className="g4" style={{marginBottom:20}}>
              {standings.slice(0,4).map((p,i)=>(
                <div key={p.id} className="card" style={{padding:18,border:i===0?"2px solid var(--gold)":"1px solid rgba(27,67,50,.06)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <Avatar init={p.avatar} color={["var(--gold)","#94A3B8","#CD7F32","var(--forest)"][i]}/>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:i===0?"var(--gold)":"var(--muted)",lineHeight:1}}>#{i+1}</span>
                  </div>
                  <p style={{fontWeight:700,fontSize:14,marginBottom:2}}>{p.name}</p>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8}}>{fmtScore(p.score)}<span style={{fontSize:11,color:"var(--muted)"}}>best 2</span></div>
                  <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6}}>
                    {p.team.map(g=><span key={g.id} style={{display:"inline-block",marginRight:3,marginBottom:2,background:"var(--cream-2)",borderRadius:3,padding:"1px 4px"}}>{g.name.split(" ").pop()}</span>)}
                  </div>
                </div>
              ))}
            </div>

            <div className="tabs" style={{maxWidth:580}}>
              {[["leaderboard","🏆 Leaderboard"],["chart","📈 Performance"],["teams","👥 Teams"],["prob","🎲 Win %"]].map(([t,l])=>(
                <button key={t} className={`tab ${analyticsTab===t?"on":""}`} onClick={()=>setAnalyticsTab(t)}>{l}</button>
              ))}
            </div>

            {analyticsTab==="leaderboard" && (
              <div className="card" style={{padding:0,overflow:"hidden"}}>
                <div className="lb-row lb-hdr" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px"}}>
                  <span>Pos</span><span>Player</span><span style={{textAlign:"right"}}>R1</span><span style={{textAlign:"right"}}>R2</span><span style={{textAlign:"right"}}>R3</span><span style={{textAlign:"right"}}>R4</span><span style={{textAlign:"right"}}>Total</span>
                </div>
                {liveScores.map(s=>{
                  const g=findGolferById(s.gId);
                  if(!g) return null;
                  const tot=s.R1+s.R2+s.R3+s.R4;
                  return (
                    <div key={s.gId} className="lb-row" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px",cursor:"pointer"}} onClick={()=>{setStatsPlayer(g);setView("stats");setStatsTab("player")}}>
                      <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:s.pos===1?"var(--gold-pale)":s.pos===2?"#E2E8F0":s.pos===3?"#FEE2CC":"var(--cream-2)",color:s.pos<=3?["#7A5C00","#475569","#9A3412"][s.pos-1]:"var(--muted)"}}>{s.pos}</div>
                      <div>
                        <p style={{fontWeight:600,fontSize:14}}>{g.country} {g.name}</p>
                        <p style={{fontSize:11,color:"var(--muted)"}}>#{g.rank} · {g.drivDist} yds</p>
                      </div>
                      {[s.R1,s.R2,s.R3,s.R4].map((v,i)=><div key={i} style={{textAlign:"right"}}>{fmtScore(v)}</div>)}
                      <div style={{textAlign:"right",fontSize:15}}>{fmtScore(tot)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {analyticsTab==="chart" && (
              <div className="card">
                <h3 className="h3" style={{marginBottom:4}}>Cumulative Score — All Rounds</h3>
                <p className="sub" style={{marginBottom:18}}>Round-by-round total score progression (lower = better)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart margin={{top:5,right:10,bottom:0,left:0}}
                    data={["R1","R2","R3","R4"].map((r,ri)=>({
                      round:r,
                      ...liveScores.slice(0,6).reduce((acc,s)=>{
                        const g=findGolferById(s.gId);
                        if(!g) return acc;
                        acc[g.name.split(" ").pop()]=[s.R1,s.R2,s.R3,s.R4].slice(0,ri+1).reduce((a,b)=>a+b,0);
                        return acc;
                      },{})
                    }))}>
                    <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                    <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                    <Tooltip content={<CTooltip/>}/>
                    {["Scheffler","McIlroy","Schauffele","Morikawa","Hovland","Rahm"].map((n,i)=>(
                      <Line key={n} type="monotone" dataKey={n} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} strokeWidth={2.5} dot={{r:4}} name={n}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {analyticsTab==="teams" && (
              <div className="g2">
                {standings.map((p,i)=>{
                  const scores=p.team.map(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls?ls.R1+ls.R2+ls.R3+ls.R4:0;}).sort((a,b)=>a-b);
                  return (
                    <div key={p.id} className="card">
                      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
                        <Avatar init={p.avatar} color={i===0?"var(--gold)":"var(--forest)"} size={36}/>
                        <div style={{flex:1}}>
                          <p style={{fontWeight:700,fontSize:14}}>{p.name}</p>
                          <p style={{fontSize:12,color:"var(--muted)"}}>Rank #{i+1}</p>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {fmtScore(p.score)}
                          <p style={{fontSize:11,color:"var(--muted)"}}>best 2</p>
                        </div>
                      </div>
                      {p.team.map((g,gi)=>{
                        const ls=liveScores.find(l=>l.gId===g.id);
                        const tot=ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                        const isCounting=tot!==null&&scores.indexOf(tot)<2;
                        return (
                          <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--cream-2)",opacity:isCounting?1:0.5}}>
                            {isCounting&&<span style={{fontSize:10,background:"var(--gold-pale)",color:"#7A5C00",padding:"1px 5px",borderRadius:3,fontWeight:700,flexShrink:0}}>★</span>}
                            {!isCounting&&<span style={{width:19,flexShrink:0}}/>}
                            <p style={{fontSize:13,flex:1,fontWeight:isCounting?600:400}}>{g.country} {g.name}</p>
                            {tot!==null?fmtScore(tot):<span style={{fontSize:12,color:"var(--muted)"}}>—</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {analyticsTab==="prob" && (
              <div className="card">
                <h3 className="h3" style={{marginBottom:4}}>Win Probability Tracker</h3>
                <p className="sub" style={{marginBottom:18}}>Simulated win % after each round based on scoring position</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={[
                    {r:"Start",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(5,25-i*3)]))},
                    {r:"R1",   ...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(3,28-i*4)]))},
                    {r:"R2",   ...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(2,32-i*5)]))},
                    {r:"R3",   ...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(1,36-i*6)]))},
                    {r:"R4",   ...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(0,i===0?55:i===1?25:i===2?12:5)]))},
                  ]}>
                    <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                    <XAxis dataKey="r" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%"/>
                    <Tooltip content={<CTooltip/>}/>
                    {standings.map((p,i)=>(
                      <Area key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0","#C0A0B0","#90A875"][i]} fill="none" strokeWidth={2} dot={{r:3}} name={p.name.split(" ")[0]}/>
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ──────── STATISTICS ──────── */}
        {view==="stats" && (
          <div className="page">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
              <div>
                <h2 className="h2">Statistics</h2>
                <p className="sub">Deep analytics · Masters Tournament · The Masters Pool 2026</p>
              </div>
              <div style={{display:"flex",gap:10}}>
                <div className="update-bar" style={{margin:0}}>
                  <div className="pulse-dot"/>
                  <span>Live · {countdown}s</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setView("analytics")}>← Analytics</button>
              </div>
            </div>

            {/* ── TOURNAMENT INFO expandable (analytics content) ── */}
            <div className="tourney-expand" style={{marginBottom:22}}>
              <div className="tourney-expand-hdr" onClick={()=>setShowTournamentInfo(s=>!s)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>🏆</span>
                  <div>
                    <p style={{fontWeight:700,fontSize:15,color:"var(--forest)"}}>Tournament Info & Pool Standings</p>
                    <p style={{fontSize:12,color:"var(--muted)"}}>Live leaderboard, team standings, win probability & performance charts</p>
                  </div>
                </div>
                <span style={{fontSize:18,color:"var(--muted)",transition:"transform .2s",transform:showTournamentInfo?"rotate(180deg)":"none"}}>▾</span>
              </div>
              {showTournamentInfo && (
                <div className="tourney-expand-body fade-up">
                  {/* Tournament header info */}
                  <div className="g4" style={{marginBottom:18}}>
                    {[
                      {l:"Tournament",v:"Masters Tournament"},
                      {l:"Venue",v:"Augusta National GC"},
                      {l:"Date",v:"Apr 9–12, 2026"},
                      {l:"Purse",v:"$20.0M"},
                    ].map(s=>(
                      <div key={s.l} style={{background:"var(--cream)",borderRadius:10,padding:"12px 14px"}}>
                        <p style={{fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4}}>{s.l}</p>
                        <p style={{fontWeight:700,fontSize:14,color:"var(--forest)"}}>{s.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mini leaderboard */}
                  <h4 className="h4" style={{marginBottom:10}}>Live Leaderboard</h4>
                  <div className="card" style={{padding:0,overflow:"hidden",marginBottom:16}}>
                    <div className="lb-row lb-hdr" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px"}}>
                      <span>Pos</span><span>Player</span><span style={{textAlign:"right"}}>R1</span><span style={{textAlign:"right"}}>R2</span><span style={{textAlign:"right"}}>R3</span><span style={{textAlign:"right"}}>R4</span><span style={{textAlign:"right"}}>Total</span>
                    </div>
                    {liveScores.map(s=>{
                      const g=findGolferById(s.gId);
                      if(!g) return null;
                      const tot=s.R1+s.R2+s.R3+s.R4;
                      return (
                        <div key={s.gId} className="lb-row" style={{gridTemplateColumns:"36px 1fr 50px 50px 50px 50px 60px"}}>
                          <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:s.pos<=3?"var(--gold-pale)":"var(--cream-2)",color:s.pos<=3?"#7A5C00":"var(--muted)"}}>{s.pos}</div>
                          <div><p style={{fontWeight:600,fontSize:14}}>{g.country} {g.name}</p></div>
                          {[s.R1,s.R2,s.R3,s.R4].map((v,i)=><div key={i} style={{textAlign:"right"}}>{fmtScore(v)}</div>)}
                          <div style={{textAlign:"right",fontSize:15}}>{fmtScore(tot)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pool standings in analytics style */}
                  <h4 className="h4" style={{marginBottom:10}}>Pool Standings</h4>
                  <div className="g4" style={{marginBottom:8}}>
                    {standings.slice(0,4).map((p,i)=>(
                      <div key={p.id} className="card" style={{padding:14,border:i===0?"2px solid var(--gold)":"none"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                          <Avatar init={p.avatar} color={["var(--gold)","#94A3B8","#CD7F32","var(--forest)"][i]} size={28}/>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:i===0?"var(--gold)":"var(--muted)"}}>{i+1}</span>
                        </div>
                        <p style={{fontWeight:700,fontSize:13}}>{p.name}</p>
                        <div style={{marginTop:4}}>{fmtScore(p.score)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Win probability mini chart */}
                  <h4 className="h4" style={{marginTop:16,marginBottom:10}}>Win Probability</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={[
                      {r:"Start",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(5,25-i*3)]))},
                      {r:"R1",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(3,28-i*4)]))},
                      {r:"R2",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(2,32-i*5)]))},
                      {r:"R3",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(1,36-i*6)]))},
                      {r:"R4",...Object.fromEntries(standings.map((p,i)=>[p.name.split(" ")[0],Math.max(0,i===0?55:i===1?25:i===2?12:5)]))},
                    ]}>
                      <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                      <XAxis dataKey="r" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%"/>
                      <Tooltip content={<CTooltip/>}/>
                      {standings.map((p,i)=>(
                        <Area key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} fill="none" strokeWidth={2}/>
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Main stats tabs */}
            <div className="tabs" style={{maxWidth:700}}>
              {[["overview","📊 Overview"],["rounds","🔄 By Round"],["players","👤 Players"],["player","🔍 Spotlight"],["compare","⚖️ Compare"]].map(([t,l])=>(
                <button key={t} className={`tab ${statsTab===t?"on":""}`} onClick={()=>setStatsTab(t)}>{l}</button>
              ))}
            </div>

            {/* OVERVIEW */}
            {statsTab==="overview" && (
              <div>
                <div className="g4" style={{marginBottom:20}}>
                  {[
                    {n:String(Math.min(...liveScores.map(s=>s.R1+s.R2+s.R3+s.R4))),l:"Best Score (Total)",sub:"Scheffler"},
                    {n:String(Math.min(...liveScores.flatMap(s=>[s.R1,s.R2,s.R3,s.R4]))),l:"Best Single Round",sub:"Best round in field"},
                    {n:String(liveScores.reduce((t,s)=>t+s.birdies.reduce((a,b)=>a+b,0),0)),l:"Total Birdies",sub:"Across all rounds"},
                    {n:String(liveScores.reduce((t,s)=>t+s.eagles.reduce((a,b)=>a+b,0),0)),l:"Eagles Made",sub:"All 4 rounds"},
                  ].map(s=>(
                    <div key={s.l} className="card stat-pill" style={{textAlign:"left",padding:"18px 20px"}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"var(--gold)",lineHeight:1}}>{s.n}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginTop:4}}>{s.l}</div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="g2" style={{marginBottom:20}}>
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Scoring Distribution</h3>
                    <p className="sub" style={{marginBottom:16}}>Eagles / Birdies / Pars / Bogeys across all rounds</p>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={liveScores.slice(0,8).map(s=>{
                        const g=findGolferById(s.gId);
                        const totalB=s.birdies.reduce((a,b)=>a+b,0);
                        const totalE=s.eagles.reduce((a,b)=>a+b,0);
                        const totalBog=s.bogeys.reduce((a,b)=>a+b,0);
                        return {name:g?.name.split(" ").pop()||"",eagles:totalE,birdies:totalB,pars:72-totalB-totalE-totalBog,bogeys:totalBog};
                      })} margin={{top:0,right:10,bottom:0,left:0}}>
                        <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                        <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <Tooltip content={<CTooltip/>}/>
                        <Bar dataKey="eagles" stackId="a" fill="#7C3AED" name="Eagles"/>
                        <Bar dataKey="birdies" stackId="a" fill="#40916C" name="Birdies"/>
                        <Bar dataKey="pars" stackId="a" fill="#D4C5A0" name="Pars"/>
                        <Bar dataKey="bogeys" stackId="a" fill="#EF4444" radius={[3,3,0,0]} name="Bogeys"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Pool Standings Timeline</h3>
                    <p className="sub" style={{marginBottom:16}}>Position changes across all 4 rounds</p>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={[{r:"Start"},{r:"After R1"},{r:"After R2"},{r:"After R3"},{r:"Final"}].map((d,ri)=>({
                        ...d,
                        ...standings.map((p,si)=>({[p.name.split(" ")[0]]:si+1+(ri===0?0:Math.max(0,si-ri+1))})).reduce((a,b)=>({...a,...b}),{})
                      }))}>
                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                        <XAxis dataKey="r" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis reversed tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>`#${v}`} domain={[1,standings.length]}/>
                        <Tooltip content={<CTooltip/>}/>
                        {standings.slice(0,4).map((p,i)=>(
                          <Line key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84"][i]} strokeWidth={2} dot={{r:4}} name={p.name.split(" ")[0]}/>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* BY ROUND */}
            {statsTab==="rounds" && (
              <div>
                {["R1","R2","R3","R4"].map((r,ri)=>(
                  <div key={r} className="card" style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <h3 className="h3">Round {ri+1}</h3>
                      <div style={{display:"flex",gap:8}}>
                        {liveScores.slice(0,3).map(s=>{
                          const g=findGolferById(s.gId);
                          return <span key={s.gId} className="badge bg-forest">{g?.name.split(" ").pop()}: {fmtScore(s[r])}</span>;
                        })}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={liveScores.slice(0,10).map(s=>{
                        const g=findGolferById(s.gId);
                        return {name:g?.name.split(" ").pop(),score:s[r],birdies:s.birdies[ri],bogeys:s.bogeys[ri]};
                      })} margin={{top:0,right:10,bottom:0,left:0}}>
                        <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                        <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                        <Tooltip content={<CTooltip/>}/>
                        <Bar dataKey="score" name="Score to Par" radius={[4,4,0,0]}>
                          {liveScores.slice(0,10).map((_,i)=>{
                            const s=liveScores[i];
                            return <Cell key={i} fill={s[r]<=-5?"#1B4332":s[r]<=-3?"#40916C":s[r]<0?"#74C69D":s[r]===0?"#D4C5A0":"#EF4444"}/>;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}

            {/* PLAYERS */}
            {statsTab==="players" && (
              <div className="card" style={{padding:0,overflow:"hidden"}}>
                <div className="lb-row lb-hdr" style={{gridTemplateColumns:"36px 1fr 60px 60px 60px 60px 70px"}}>
                  <span>#</span><span>Player</span><span style={{textAlign:"right"}}>Avg</span><span style={{textAlign:"right"}}>Drive</span><span style={{textAlign:"right"}}>GIR%</span><span style={{textAlign:"right"}}>SG</span><span style={{textAlign:"right"}}>Total</span>
                </div>
                {liveScores.map(s=>{
                  const g=findGolferById(s.gId);
                  if(!g) return null;
                  const tot=s.R1+s.R2+s.R3+s.R4;
                  return (
                    <div key={s.gId} className="lb-row" style={{gridTemplateColumns:"36px 1fr 60px 60px 60px 60px 70px",cursor:"pointer"}} onClick={()=>{setStatsPlayer(g);setStatsTab("player")}}>
                      <div style={{width:26,height:26,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,background:"var(--cream-2)",color:"var(--muted)"}}>{g.rank}</div>
                      <div>
                        <p style={{fontWeight:600,fontSize:14}}>{g.country} {g.name}</p>
                        <p style={{fontSize:11,color:"var(--muted)"}}>{g.drivDist} yds · {g.drivAcc}% acc</p>
                      </div>
                      <div style={{textAlign:"right",fontSize:13,fontWeight:600}}>{g.avg}</div>
                      <div style={{textAlign:"right",fontSize:13}}>{g.drivDist}</div>
                      <div style={{textAlign:"right",fontSize:13}}>{g.gir}%</div>
                      <div style={{textAlign:"right",fontSize:13,color:g.sg>0?"var(--forest)":"var(--red)",fontWeight:600}}>{g.sg>0?"+":""}{g.sg}</div>
                      <div style={{textAlign:"right",fontSize:15}}>{fmtScore(tot)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PLAYER SPOTLIGHT */}
            {statsTab==="player" && (
              <div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
                  {liveScores.map(s=>{
                    const g=findGolferById(s.gId);
                    if(!g) return null;
                    return (
                      <button key={g.id} className={`btn btn-sm ${statsPlayer?.id===g.id?"btn-prim":"btn-ghost"}`}
                        onClick={()=>setStatsPlayer(g)}>
                        {g.country} {g.name.split(" ").pop()}
                      </button>
                    );
                  })}
                </div>
                {statsPlayer && (()=>{
                  const rounds=getPlayerRounds(statsPlayer.id);
                  const sg=getSGData(statsPlayer.id);
                  const ls=liveScores.find(l=>l.gId===statsPlayer.id);
                  const tot=ls?ls.R1+ls.R2+ls.R3+ls.R4:null;
                  return (
                    <div>
                      <div className="card" style={{marginBottom:20}}>
                        <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                          <Avatar init={statsPlayer.name.split(" ").map(w=>w[0]).slice(0,2).join("")} size={56} color="var(--forest)"/>
                          <div style={{flex:1}}>
                            <h2 className="h2">{statsPlayer.country} {statsPlayer.name}</h2>
                            <p className="sub">World Rank #{statsPlayer.rank} · Avg {statsPlayer.avg} · SG {statsPlayer.sg>0?"+":""}{statsPlayer.sg}</p>
                          </div>
                          <div style={{display:"flex",gap:14}}>
                            {[["Total",fmtScore(tot)],["Drive",`${statsPlayer.drivDist} yds`],["GIR",`${statsPlayer.gir}%`]].map(([l,v])=>(
                              <div key={l} className="stat-pill">
                                <div className="stat-pill-n">{v}</div>
                                <div className="stat-pill-l">{l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="g2" style={{marginBottom:18}}>
                        <div className="card">
                          <h3 className="h3" style={{marginBottom:4}}>Round-by-Round Score</h3>
                          <p className="sub" style={{marginBottom:16}}>Score to par each round</p>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={rounds} margin={{top:10,right:10,bottom:0,left:0}} barCategoryGap="30%">
                              <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                              <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                              <YAxis
                                tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}
                                tickFormatter={v=>v>0?`+${v}`:v===0?"E":v}
                                domain={[dataMin=>Math.min(dataMin-1,-1), dataMax=>Math.max(dataMax+1,1)]}
                              />
                              <Tooltip formatter={(v)=>[v>0?`+${v}`:v===0?"E":v,"Score"]}/>
                              <ReferenceLine y={0} stroke="var(--parchment)" strokeWidth={1.5}/>
                              <Bar dataKey="score" name="Score" maxBarSize={48}>
                                {rounds.map((r,i)=>(
                                  <Cell key={i} fill={r.score<=-5?"#1B4332":r.score<=-3?"#2D6A4F":r.score<0?"#74C69D":r.score===0?"#D4C5A0":r.score<=2?"#F97316":"#EF4444"} radius={r.score<0?[0,0,4,4]:[4,4,0,0]}/>
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {sg.length>0&&(
                          <div className="card">
                            <h3 className="h3" style={{marginBottom:4}}>Strokes Gained</h3>
                            <p className="sub" style={{marginBottom:16}}>SG breakdown by category</p>
                            <ResponsiveContainer width="100%" height={220}>
                              <RadarChart data={sg} margin={{top:10,right:10,bottom:10,left:10}}>
                                <PolarGrid stroke="var(--parchment)"/>
                                <PolarAngleAxis dataKey="stat" tick={{fontSize:10,fill:"#78716C"}}/>
                                <PolarRadiusAxis angle={30} domain={[-0.5,2]} tick={{fontSize:8,fill:"#CBD5E1"}} tickCount={4}/>
                                <Radar name={statsPlayer.name} dataKey="value" stroke="var(--forest)" fill="var(--forest)" fillOpacity={0.2} strokeWidth={2}/>
                                <Tooltip content={<CTooltip/>}/>
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                      <div className="card">
                        <h3 className="h3" style={{marginBottom:14}}>Scoring Breakdown per Round</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={rounds} margin={{top:0,right:10,bottom:0,left:0}}>
                            <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                            <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                            <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                            <Tooltip content={<CTooltip/>}/>
                            <Bar dataKey="eagles" stackId="a" fill="#7C3AED" name="Eagles"/>
                            <Bar dataKey="birdies" stackId="a" fill="#40916C" name="Birdies"/>
                            <Bar dataKey="pars" stackId="a" fill="#D4C5A0" name="Pars"/>
                            <Bar dataKey="bogeys" stackId="a" fill="#EF4444" radius={[3,3,0,0]} name="Bogeys"/>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="g4" style={{marginTop:12}}>
                          {[["Eagles",rounds.reduce((s,r)=>s+r.eagles,0),"#7C3AED"],["Birdies",rounds.reduce((s,r)=>s+r.birdies,0),"#40916C"],["Pars",rounds.reduce((s,r)=>s+r.pars,0),"#D4C5A0"],["Bogeys",rounds.reduce((s,r)=>s+r.bogeys,0),"#EF4444"]].map(([n,v,c])=>(
                            <div key={n} style={{background:"var(--cream)",borderRadius:9,padding:"10px",textAlign:"center"}}>
                              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{n}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {!statsPlayer&&<div style={{textAlign:"center",padding:"60px 40px",color:"var(--muted)"}}>Select a player above to view their spotlight stats</div>}
              </div>
            )}

            {/* COMPARE */}
            {statsTab==="compare" && (
              <div>
                <div className="card" style={{marginBottom:20}}>
                  <h3 className="h3" style={{marginBottom:4}}>Head-to-Head: Top 6 Players</h3>
                  <p className="sub" style={{marginBottom:18}}>Total score comparison across all 4 rounds</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={liveScores.slice(0,6).map(s=>{
                      const g=findGolferById(s.gId);
                      return {name:g?.name.split(" ").pop(),R1:s.R1,R2:s.R2,R3:s.R3,R4:s.R4};
                    })} margin={{top:0,right:10,bottom:0,left:0}}>
                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                      <XAxis dataKey="name" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                      <Tooltip content={<CTooltip/>}/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                      <Bar dataKey="R1" name="R1" fill="#1B4332"/>
                      <Bar dataKey="R2" name="R2" fill="#2D6A4F"/>
                      <Bar dataKey="R3" name="R3" fill="#40916C"/>
                      <Bar dataKey="R4" name="R4" fill="#74C69D"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 className="h3" style={{marginBottom:4}}>Driving Stats Comparison</h3>
                  <p className="sub" style={{marginBottom:18}}>Distance vs Accuracy for field players</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={poolTournamentField.slice(0,12).map(g=>({name:g.name.split(" ").pop(),distance:g.drivDist,accuracy:g.drivAcc,gir:g.gir}))}
                      margin={{top:0,right:10,bottom:0,left:0}}>
                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                      <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                      <YAxis yAxisId="left" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                      <YAxis yAxisId="right" orientation="right" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%"/>
                      <Tooltip content={<CTooltip/>}/>
                      <Bar yAxisId="left" dataKey="distance" name="Drive Dist (yds)" fill="#1B4332" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
