import React, { useState, useEffect, useRef, useCallback } from "react";
import { Golfers, Courses, Invites, Auth, Pools, Draft, session as apiSession, token as apiToken } from "./api";
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
.nav-home-btn{display:inline-flex;align-items:center;justify-content:center;padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#ecf4ee;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .16s}
.nav-home-btn:hover{background:rgba(255,255,255,.14);transform:translateY(-1px)}
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
.hero{background:linear-gradient(148deg,#06140f 0%,#113727 55%,#0e2a1e 100%);padding:80px 40px;position:relative;overflow:hidden;text-align:center}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 70%,rgba(200,169,79,.09) 0%,transparent 50%),radial-gradient(ellipse at 80% 25%,rgba(64,145,108,.1) 0%,transparent 50%)}
.hero::after{display:none}
.hero-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;background:rgba(200,169,79,.14);border:1px solid rgba(200,169,79,.28);color:var(--gold);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px}
.hero-title{font-family:'Cormorant Garamond',serif;font-size:60px;font-weight:700;color:#fff;line-height:1.06;margin-bottom:16px}
.hero-title span{color:var(--gold)}
.hero-logo{width:100%;max-width:700px;height:auto;display:block;margin:0 auto}
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
.pick-row:hover:not(.drafted):not(.disabled){background:#fff;box-shadow:var(--sh);border-color:var(--forest-pale);transform:translateX(2px)}
.pick-row.drafted{opacity:.32;cursor:default;pointer-events:none}
.pick-row.disabled{opacity:.55;cursor:not-allowed}
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
.link-txt{font-size:12px;color:var(--forest-mid);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;display:block}

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

// Legacy demo SG_DATA – kept as fallback for seed/demo golfer IDs 1-12
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
  {id:"p3",name:"Office Golf Classic",tournamentId:"t2",status:"complete",participants:5,maxParticipants:12,yourRank:1,yourScore:-39,teamSize:4,scoringGolfers:3,cutLine:2,shotClock:45,created:"Jan 10",hostId:2},
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
const SITE_BASE = (
  import.meta.env.VITE_SITE_URL ||
  import.meta.env.REACT_APP_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://golfpoolpro.vercel.app")
).replace(/\/$/, "");
const SCORE_REFRESH_MS = Math.max(1000, Number(import.meta.env.VITE_SCORE_REFRESH_MS || 30000));
const SCORE_REFRESH_SECONDS = Math.ceil(SCORE_REFRESH_MS / 1000);
const USE_MOCK_FIELD = String(import.meta.env.VITE_USE_MOCK_FIELD || "").toLowerCase() === "true";
const DEMO_EMAILS = new Set(["james@example.com","sarah@example.com","mike@example.com","emma@example.com","david@example.com"]);

const fmtTDate = (isoDate) => {
  if(!isoDate) return "TBD";
  const d = new Date(isoDate);
  if(Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
};

const makeInviteToken = () => Math.random().toString(36).slice(2, 10);

const encodeInviteData = (pool) => {
  try {
    const payload = {
      id: pool?.id || null,
      name: pool?.name || "Pool Invite",
      invite_token: pool?.invite_token || pool?.inviteToken || null,
      tournamentId: pool?.tournamentId || pool?.tournament_id || "",
      tournamentName: pool?.tournamentName || "",
      status: pool?.status || "lobby",
      participants: Number(pool?.participants || pool?.current_members || 0),
      maxParticipants: Number(pool?.maxParticipants || pool?.max_participants || 8),
      teamSize: Number(pool?.teamSize || pool?.team_size || 4),
      scoringGolfers: Number(pool?.scoringGolfers || pool?.scoring_golfers || 2),
      shotClock: Number(pool?.shotClock || pool?.shot_clock || 60),
      cutLine: Number(pool?.cutLine || pool?.cut_line || 2),
      hostId: pool?.hostId || pool?.host_id || null,
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return "";
  }
};

const decodeInviteData = (encoded) => {
  if (!encoded) return null;
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const parseInviteDataFromLocation = () => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const hashQuery = hash.includes("?") ? hash.split("?")[1] : "";
  const fromHash = new URLSearchParams(hashQuery).get("d");
  if (fromHash) return decodeInviteData(fromHash);
  const fromSearch = new URLSearchParams(window.location.search || "").get("d");
  if (fromSearch) return decodeInviteData(fromSearch);
  return null;
};

const parseInviteTokenFromLocation = () => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const hashMatch = hash.match(/^#\/join\/([^/?#]+)/i);
  if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);
  const pathMatch = window.location.pathname.match(/^\/join\/([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  return null;
};

const clearInviteRouteFromLocation = () => {
  if (typeof window === "undefined") return;
  try {
    const hasInvitePath = /^\/join\/[^/?#]+/i.test(window.location.pathname || "");
    const hasInviteHash = /^#\/join\/[^/?#]+/i.test(window.location.hash || "");
    if (hasInvitePath || hasInviteHash) {
      // Ensure invite routing doesn't re-trigger after a successful join.
      history.replaceState(null, "", "/");
      return;
    }
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch {}
};

const parseRecoveryTokensFromLocation = () => {
  if (typeof window === "undefined") return null;
  const readParams = (raw) => {
    const params = new URLSearchParams(raw || "");
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (type === "recovery" && accessToken) return { accessToken, refreshToken };
    return null;
  };
  const hashRaw = (window.location.hash || "").replace(/^#/, "");
  const fromHash = readParams(hashRaw);
  if (fromHash) return fromHash;
  return readParams(window.location.search || "");
};

/* ─── HELPERS ─── */
const fmtScore = (s) => {
  // Keep empty for missing/unplayed rounds so future tournaments don't prefill with "—/N/A".
  if(s===null||s===undefined) return <span style={{color:"#CBD5E1"}}></span>;
  if(s===0) return <span className="even">E</span>;
  if(s<0) return <span className="under">{s}</span>;
  return <span className="over">+{s}</span>;
};

const sumRounds = (ls) => {
  if (!ls) return null;
  const rounds = [ls.R1, ls.R2, ls.R3, ls.R4];
  const hasAny = rounds.some((v) => typeof v === "number");
  if (!hasAny) return null;
  return rounds.reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
};

/**
 * Calculate win probability for pool participants after each round.
 * Uses softmax on score gaps with confidence scaling by rounds played.
 * Returns [{r:"Start",...},{r:"R1",...},...] with participant first-name keys → probability %.
 */
const calcWinProb = (participants, getTeamFn, liveScoresList, scoringCount) => {
  const roundKeys = ["R1","R2","R3","R4"];
  const names = participants.map(p => p.name.split(" ")[0]);

  // Determine how many rounds have actual data
  const maxRound = roundKeys.reduce((mx, rk) => {
    const hasData = liveScoresList.some(s => typeof s[rk] === "number");
    return hasData ? roundKeys.indexOf(rk) + 1 : mx;
  }, 0);

  // Start: equal probability
  const equalPct = Math.round(100 / Math.max(participants.length, 1));
  const rows = [{ r: "Start", ...Object.fromEntries(names.map(n => [n, equalPct])) }];

  // For each round played so far, compute cumulative scores and softmax probability
  for (let ri = 0; ri < 4; ri++) {
    if (ri >= maxRound) break;
    // Confidence grows each round: alpha controls how much score gap matters
    const alpha = 0.15 + ri * 0.12; // R1=0.15, R2=0.27, R3=0.39, R4=0.51

    const cumScores = participants.map((p, pi) => {
      const team = getTeamFn(p.id);
      const golferCumScores = team.map(g => {
        const ls = liveScoresList.find(l => l.gId === g.id);
        if (!ls) return null;
        const rds = roundKeys.slice(0, ri + 1).map(rk => ls[rk]).filter(v => typeof v === "number");
        return rds.length > 0 ? rds.reduce((a, b) => a + b, 0) : null;
      }).filter(v => v !== null).sort((a, b) => a - b);

      const best = golferCumScores.slice(0, scoringCount);
      return best.length > 0 ? best.reduce((a, b) => a + b, 0) : null;
    });

    const validScores = cumScores.filter(v => v !== null);
    if (validScores.length === 0) break;

    const minScore = Math.min(...validScores);
    // Softmax: lower score = higher probability (golf: lower is better)
    const exps = cumScores.map(s => s !== null ? Math.exp(-alpha * (s - minScore)) : 0.001);
    const total = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => Math.round((e / total) * 100));
    // Adjust so they sum to 100
    const probSum = probs.reduce((a, b) => a + b, 0);
    if (probSum > 0 && probSum !== 100) probs[0] += 100 - probSum;

    rows.push({ r: roundKeys[ri], ...Object.fromEntries(names.map((n, i) => [n, probs[i]])) });
  }

  return { data: rows, names };
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
  const adminTab = "config";
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
  const [showUserMenu,setShowUserMenu] = useState(false);
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
  const [inviteJoinRequested,setInviteJoinRequested] = useState(false);
  const [authMode,setAuthMode] = useState("login"); // "login"|"signup"|"forgot"|"join"
  const [authEmail,setAuthEmail] = useState(()=> LS.get("mgpp_last_email","") || "");
  const [authPass,setAuthPass] = useState("");
  const [authName,setAuthName] = useState("");
  const [authError,setAuthError] = useState("");
  const [authSuccess,setAuthSuccess] = useState("");
  const [forgotSent,setForgotSent] = useState(false);
  const [authBusy,setAuthBusy] = useState(false);
  const [readyBusyMap,setReadyBusyMap] = useState({});
  const [deleteBusy,setDeleteBusy] = useState(false);
  const [createBusy,setCreateBusy] = useState(false);
  const [activeLobbyUserIds,setActiveLobbyUserIds] = useState([]);
  const [chatMessages,setChatMessages] = useState([]);
  const [chatText,setChatText] = useState("");
  const [chatBusy,setChatBusy] = useState(false);
  const [draftPaused,setDraftPaused] = useState(false);
  const [serverTimeRemaining,setServerTimeRemaining] = useState(null);
  const lastServerPickNumRef = useRef(null);
  const [resetPass,setResetPass] = useState("");
  const [resetPassConfirm,setResetPassConfirm] = useState("");
  const loginEmailRef = useRef(null);
  const loginPassRef = useRef(null);
  const signupNameRef = useRef(null);
  const signupEmailRef = useRef(null);
  const signupPassRef = useRef(null);
  const forgotEmailRef = useRef(null);
  const resetPassRef = useRef(null);
  const resetPassConfirmRef = useRef(null);
  const userMenuRef = useRef(null);
  const chatEndRef = useRef(null);

  const handleAuthEnter = (e, { nextRef = null, submit = null } = {}) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (authBusy) return;
    if (nextRef?.current) {
      nextRef.current.focus();
      try { nextRef.current.select?.(); } catch {}
      return;
    }
    if (typeof submit === "function") submit();
  };

  useEffect(() => {
    if (!showUserMenu) return;
    const onDocClick = (ev) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(ev.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showUserMenu]);

  // Config for new pool creation
  const [config,setConfig] = useState({
    poolName:"Sunday Showdown",tournament:"",maxParticipants:12,
    teamSize:4,scoringGolfers:2,cutLine:2,shotClock:60,draftOrderType:"ordered",
  });
  const [pendingInviteToken, setPendingInviteToken] = useState(() => makeInviteToken());
  const [randomizedOrder,setRandomizedOrder] = useState([]);

  const [participants,setParticipants] = useState(()=> LS.get("mgpp_participants", []));
  const [drafted,setDrafted] = useState([]);
  const [currentPick,setCurrentPick] = useState(0);
  const [timer,setTimer] = useState(60);
  const [draftActive,setDraftActive] = useState(false);
  const [draftDone,setDraftDone] = useState(false);
  const [pickBusy,setPickBusy] = useState(false);
  const pickBusyRef = useRef(false);
  const [search,setSearch] = useState("");
  const [saved,setSaved] = useState(false);
  const timerRef = useRef(null);
  const [filterPos,setFilterPos] = useState("all");

  // Live scores state — updates every 5 minutes (matches GitHub Actions cron)
  const [liveScores,setLiveScores] = useState([]);
  const [lastUpdated,setLastUpdated] = useState(new Date());
  const [countdown,setCountdown] = useState(SCORE_REFRESH_SECONDS);
  const nextRefreshAtRef = useRef(0);
  const hasBackendSession = !!apiToken.get() || !!apiToken.getRefresh();

  // ── Persist critical state to localStorage ──
  useEffect(()=>{ LS.set("mgpp_pools", pools); },[pools]);
  useEffect(()=>{ LS.set("mgpp_session", currentUser); },[currentUser]);
  useEffect(()=>{ LS.set("mgpp_picks", allDrafted); },[allDrafted]);
  useEffect(()=>{ LS.set("mgpp_members", poolMembers); },[poolMembers]);
  useEffect(()=>{ LS.set("mgpp_participants", participants); },[participants]);
  useEffect(()=>{ LS.set("mgpp_last_email", authEmail || ""); },[authEmail]);
  useEffect(()=>{
    if (view !== "invite") return;
    const t = setTimeout(() => {
      if (authMode === "login") loginEmailRef.current?.focus();
      else if (authMode === "signup") signupNameRef.current?.focus();
      else if (authMode === "forgot") forgotEmailRef.current?.focus();
      else if (authMode === "reset") resetPassRef.current?.focus();
    }, 0);
    return ()=>clearTimeout(t);
  },[view,authMode]);

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

  // ── Handle invite links via URL hash or path e.g. #/join/token or /join/token ──
  useEffect(() => {
    const recovery = parseRecoveryTokensFromLocation();
    if (!recovery?.accessToken) return;
    try {
      apiToken.set(recovery.accessToken);
      if (recovery.refreshToken) apiToken.setRefresh(recovery.refreshToken);
    } catch {}
    setInvitePool(null);
    setInviteView(true);
    setAuthMode("reset");
    setAuthError("");
    setAuthSuccess("");
    setForgotSent(false);
    setView("invite");
    try {
      history.replaceState(null, "", "/");
    } catch {}
  }, []);

  // ── Handle invite links via URL hash or path e.g. #/join/token or /join/token ──
  useEffect(() => {
    let cancelled = false;
    const handleInviteRoute = async () => {
      const token = parseInviteTokenFromLocation();
      const payload = parseInviteDataFromLocation();
      if (!token) return;

      const localPool = pools.find(
        (p) =>
          p.invite_token === token ||
          p.inviteToken === token ||
          p.id === token
      );
      if (localPool) {
        openInvite(localPool);
        return;
      }

      if (payload && (payload.invite_token === token || payload.id === token || !payload.invite_token)) {
        openInvite({
          ...payload,
          invite_token: payload.invite_token || token,
          inviteToken: payload.invite_token || token,
          id: payload.id || `inv_${token}`,
        });
        return;
      }

      try {
        const resp = await Invites.resolve(token);
        if (cancelled) return;
        const resolved = resp?.pool;
        if (!resolved) throw new Error("Invite not found");
        const mappedPool = {
          id: resolved.id,
          name: resolved.name || "Pool Invite",
          status: resolved.status || "lobby",
          maxParticipants: resolved.max_participants || 12,
          participants: resolved.current_members || 0,
          teamSize: resolved.team_size || 4,
          scoringGolfers: resolved.scoring_golfers || 2,
          tournamentId: resolved.tournament?.id || "",
          tournamentName: resolved.tournament?.name || "",
          invite_token: resolved.invite_token || token,
          hostId: resolved.host_id || null,
        };
        openInvite(mappedPool);
      } catch {
        if (!cancelled) {
          // Fallback to token-only invite flow so login/signup/join can still proceed.
          openInvite({
            id: `inv_${token}`,
            name: "Pool Invite",
            invite_token: token,
            inviteToken: token,
            status: "lobby",
            participants: 0,
            maxParticipants: 12,
            teamSize: 4,
            scoringGolfers: 2,
            cutLine: 2,
            shotClock: 60,
            tournamentName: "",
            tournamentId: "",
          });
        }
      }
    };

    handleInviteRoute();
    window.addEventListener("hashchange", handleInviteRoute);
    window.addEventListener("popstate", handleInviteRoute);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", handleInviteRoute);
      window.removeEventListener("popstate", handleInviteRoute);
    };
  }, [pools]); // eslint-disable-line react-hooks/exhaustive-deps

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
          start_date: t.start_date || t.startDate || null,
          end_date: t.end_date || t.endDate || null,
          date: fmtTDate(t.start_date || t.startDate),
          purse: t.purse ? `$${Number(t.purse).toLocaleString()}` : "TBD",
          field: Number(t.field_size || t.field) || null
        }));
        setTournaments(mapped);
      } catch {
        setTournaments([]);
      }
    };
    loadTournaments();
  },[]);

  // Backfill legacy pools that were created without a tournament selection.
  useEffect(() => {
    if (!tournaments.length) return;
    if (!activePool) return;
    if (activePool.tournamentId || activePool.tournament) return;

    const fallbackTournamentId = tournaments[0]?.id;
    if (!fallbackTournamentId) return;

    setActivePool((p) => (p ? { ...p, tournamentId: fallbackTournamentId } : p));
    setPools((prev) =>
      prev.map((p) =>
        p.id === activePool.id ? { ...p, tournamentId: fallbackTournamentId } : p
      )
    );
    notify(`Assigned ${tournaments[0]?.name || "a tournament"} to this legacy pool.`, "success");
  }, [tournaments, activePool]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTournamentId = activePool?.tournamentId || config.tournamentId || config.tournament || "";

  useEffect(()=>{
    if(!selectedTournamentId){
      setApiGolfers([]);
      setLiveScores([]);
      setTournamentCourse(null);
      setCountdown(SCORE_REFRESH_SECONDS);
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
	          // Keep missing rounds null so future tournaments don't prefill with "E".
	          R1: s.r1 ?? null,
	          R2: s.r2 ?? null,
	          R3: s.r3 ?? null,
	          R4: s.r4 ?? null,
	          pos: s.position ?? null,
	          birdies: s.birdies || [0,0,0,0],
	          eagles: s.eagles || [0,0,0,0],
	          bogeys: s.bogeys || [0,0,0,0],
	        })));
        setLastUpdated(new Date());
      } catch {}
    };

    const scheduleNextRefresh = () => {
      nextRefreshAtRef.current = Date.now() + SCORE_REFRESH_MS;
    };

    pull();
    scheduleNextRefresh();
    setCountdown(SCORE_REFRESH_SECONDS);

    const tick = setInterval(() => {
      const remainingMs = Math.max(0, nextRefreshAtRef.current - Date.now());
      setCountdown(Math.ceil(remainingMs / 1000));
    }, 250);

    const refresh = setInterval(() => {
      pull();
      scheduleNextRefresh();
    }, SCORE_REFRESH_MS);

    return ()=>{ clearInterval(tick); clearInterval(refresh); };
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

  useEffect(() => {
    const su = apiSession.get();
    if (!currentUser && su?.id) {
      setCurrentUser(su.id);
      LS.set("mgpp_session", su.id);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!apiToken.get() && !apiToken.getRefresh() && currentUser) {
      setCurrentUser(null);
      LS.set("mgpp_session", null);
    }
  }, [currentUser]);

  // Hydrate/validate backend auth session so "logged in" always matches server state.
  useEffect(() => {
    const t = apiToken.get();
    const rt = apiToken.getRefresh();
    if (!t && !rt) return;
    let cancelled = false;
    const hydrate = async () => {
      try {
        let resp;
        try {
          resp = await Auth.me();
        } catch (e) {
          const status = Number(e?.status || 0);
          if (status === 401) {
            try {
              await Auth.refresh();
              resp = await Auth.me();
            } catch {
              throw e;
            }
          } else {
            throw e;
          }
        }
        const u = resp?.user;
        if (cancelled || !u?.id) return;
        apiSession.set(u);
        setCurrentUser(u.id);
        LS.set("mgpp_session", u.id);
        ensureParticipant({
          id: u.id,
          name: u.name || u.email || "User",
          email: u.email || "",
          avatar: u.avatar || (u.name || "U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
        });
      } catch {
        if (cancelled) return;
        try { apiToken.clear(); } catch {}
        setCurrentUser(null);
        setAuthMode("login");
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, []);

  // Pull pools from backend for authenticated sessions (shared across users/devices).
  useEffect(() => {
    if (!apiToken.get()) return;
    let cancelled = false;
    const pullPools = async () => {
      try {
        const resp = await Pools.list();
        if (cancelled) return;
        const nowMs = Date.now();
        const mapped = (resp?.pools || []).map((p) => ({
          // Hide scores until the tournament actually starts.
          _tournamentStarted: (() => {
            const iso = p.tournament?.start_date;
            if (!iso) return false;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return false;
            return nowMs >= d.getTime();
          })(),
          id: p.id,
          name: p.name,
          status: p.status || "lobby",
          tournamentId: p.tournament?.id || p.tournament_id || "",
          tournamentName: p.tournament?.name || "",
          participants: Number(p.participants || 0),
          maxParticipants: Number(p.max_participants || p.maxParticipants || 8),
          teamSize: Number(p.team_size || p.teamSize || 4),
          scoringGolfers: Number(p.scoring_golfers || p.scoringGolfers || 2),
          cutLine: Number(p.cut_line || p.cutLine || 2),
          shotClock: Number(p.shot_clock || p.shotClock || 60),
          draftOrderType: p.draft_order_type || p.draftOrderType || "ordered",
          invite_token: p.invite_token || null,
          hostId: p.host_id || null,
          yourRank: p.yourRank ?? null,
          yourScore: (() => {
            const iso = p.tournament?.start_date;
            if (!iso) return null;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            // If event hasn't started, keep score blank even if standings view returns 0.
            if (nowMs < d.getTime()) return null;
            return p.yourScore ?? null;
          })(),
          created: p.created_at ? new Date(p.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
        }));
        setPools(mapped);
      } catch {}
    };
    pullPools();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Sync active pool members + picks from backend so lobby and draft stay shared.
  useEffect(() => {
    if (!apiToken.get() || !activePool?.id || view !== "pool") return;
    let cancelled = false;
    const syncPool = async () => {
      try {
        const resp = await Pools.get(activePool.id);
        if (cancelled) return;
        const members = resp?.members || [];
        const picks = resp?.picks || [];

        const mappedPeople = members.map((m) => ({
          id: m.user_id,
          name: m.profile?.name || "Player",
          avatar: m.profile?.avatar || ((m.profile?.name || "PL").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()),
          email: m.profile?.email || "",
          joined: true,
        }));
        setParticipants((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          mappedPeople.forEach((p) => byId.set(p.id, { ...(byId.get(p.id) || {}), ...p, joined: true }));
          return [...byId.values()];
        });
        setPoolMembers((prev) => ({ ...prev, [activePool.id]: mappedPeople.map((p) => p.id) }));
        setPoolReadyMap((prev) => ({
          ...prev,
          ...Object.fromEntries(members.map((m) => [m.user_id, !!m.is_ready])),
        }));
        setAllDrafted((prev) => ({
          ...prev,
          [activePool.id]: picks.map((p) => ({
            golferId: p.golfer_id,
            participantId: p.user_id,
            pickNum: p.pick_number,
          })),
        }));
        setActiveLobbyUserIds(Array.isArray(resp?.activeLobbyUserIds) ? resp.activeLobbyUserIds : []);
        setDrafted(picks.map((p) => ({
          golferId: p.golfer_id,
          participantId: p.user_id,
          pickNum: p.pick_number,
        })));
        setCurrentPick(picks.length);
        setActivePool((pool) => pool ? ({
          ...pool,
          status: resp?.pool?.status || pool.status,
          participants: mappedPeople.length,
          maxParticipants: Number(resp?.pool?.max_participants || pool.maxParticipants || 8),
          teamSize: Number(resp?.pool?.team_size || pool.teamSize || 4),
          scoringGolfers: Number(resp?.pool?.scoring_golfers || pool.scoringGolfers || 2),
          cutLine: Number(resp?.pool?.cut_line || pool.cutLine || 2),
          shotClock: Number(resp?.pool?.shot_clock || pool.shotClock || 60),
          tournamentId: resp?.pool?.tournament_id || pool.tournamentId,
          invite_token: resp?.pool?.invite_token || pool.invite_token,
          hostId: resp?.pool?.host_id || pool.hostId,
        }) : pool);
        const nextStatus = resp?.pool?.status || activePool.status;
        if (nextStatus === "draft") {
          setPoolPhase("draft");
          // In shared mode, "draftActive" must follow the server's status; don't rely on local startDraft().
          setDraftActive(true);
          // Pool status should flip to "live" when complete, but keep this safe if status lags.
          const ts = Number(resp?.pool?.team_size || activePool?.teamSize || 0);
          const total = (members.length || 0) * (ts || 0);
          if (total > 0 && picks.length >= total) {
            setDraftDone(true);
          } else {
            setDraftDone(false);
          }
        } else if (nextStatus === "live" || nextStatus === "complete") {
          setPoolPhase("live");
          setDraftActive(false);
          setDraftDone(false);
        } else {
          setPoolPhase("lobby");
          setDraftActive(false);
          setDraftDone(false);
        }
      } catch {}
    };
    syncPool();
    const t = setInterval(syncPool, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activePool?.id, view, currentUser]);

  // Broadcast active presence only while user is actively on this pool lobby view.
  useEffect(() => {
    if (!apiToken.get() || !activePool?.id || view !== "pool" || poolPhase !== "lobby") return undefined;
    let stopped = false;
    const beat = async () => {
      try {
        const resp = await Pools.heartbeat(activePool.id);
        if (!stopped && Array.isArray(resp?.activeLobbyUserIds)) {
          setActiveLobbyUserIds(resp.activeLobbyUserIds);
        }
      } catch {}
    };
    beat();
    const t = setInterval(beat, 5000);
    const leaveNow = async () => {
      try { await Pools.leavePresence(activePool.id); } catch {}
    };
    window.addEventListener("pagehide", leaveNow);
    return () => {
      stopped = true;
      clearInterval(t);
      window.removeEventListener("pagehide", leaveNow);
      leaveNow();
    };
  }, [activePool?.id, poolPhase, view, currentUser]);

  // Lightweight pool chat polling (lobby + draft).
  useEffect(() => {
    if (!apiToken.get() || !activePool?.id || view !== "pool") return;
    if (poolPhase !== "lobby" && poolPhase !== "draft") return;
    let stopped = false;
    const poll = async () => {
      try {
        const resp = await Pools.chatList(activePool.id);
        if (stopped) return;
        const msgs = Array.isArray(resp?.messages) ? resp.messages : [];
        setChatMessages(msgs);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [activePool?.id, poolPhase, view, currentUser]);

  // Draft state polling (pause + server time remaining) for shared drafts.
  useEffect(() => {
    if (!apiToken.get() || !activePool?.id || view !== "pool" || poolPhase !== "draft") return;
    let stopped = false;
    const poll = async () => {
      try {
        const state = await Draft.state(activePool.id);
        if (stopped) return;
        setDraftPaused(!!state?.paused);
        if (typeof state?.timeRemaining === "number") {
          const srv = state.timeRemaining;
          setServerTimeRemaining(srv);

          const srvPickNumRaw = Number(state?.pickNumber);
          const srvPickNum = Number.isFinite(srvPickNumRaw)
            ? srvPickNumRaw
            : (Array.isArray(state?.picks) ? state.picks.length : null);
          const prevPickNum = lastServerPickNumRef.current;
          const isNewPick = typeof srvPickNum === "number" && srvPickNum !== prevPickNum;
          if (typeof srvPickNum === "number") lastServerPickNumRef.current = srvPickNum;

          // Keep a smooth UI countdown between polls:
          // - Snap on a new pick (pick number changes)
          // - Otherwise only snap downward when server indicates less time remaining
          //   (don't snap upward on server restarts/load balancing; it causes a stuck-at-60 timer).
          setTimer((prev) => {
            if (typeof prev !== "number") return srv;
            if (isNewPick) return srv;
            if ((prev - srv) > 2) return srv;
            return prev;
          });
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [activePool?.id, poolPhase, view, currentUser]);

  useEffect(() => {
    try { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); } catch {}
  }, [chatMessages.length]);

  // Require backend auth session for all non-invite screens.
  useEffect(()=>{
    if(!hasBackendSession && view!=="invite"){
      setActivePool(null);
      setView("invite");
      setInvitePool(null);
      setInviteView(true);
      setAuthMode("login");
      setAuthError("");
    }
  },[hasBackendSession, view]);

  // Active pool config
  const poolConfig = activePool || config;
  const golferCatalog = apiGolfers.length ? apiGolfers : (USE_MOCK_FIELD ? FULL_FIELD : []);
  const getTournamentById = (id) => tournaments.find(x=>x.id===id);
  const parseIsoDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const hasTournamentStarted = (id) => {
    const t = getTournamentById(id);
    const start = parseIsoDate(t?.start_date);
    if (!start) return false;
    return Date.now() >= start.getTime();
  };
  const getTournamentFieldSize = (id) => {
    const t = getTournamentById(id);
    // Prefer the actual available golfer list when we have it, so the UI matches the draft room.
    if (id && id === selectedTournamentId && apiGolfers.length) return apiGolfers.length;
    const field = Number(t?.field);
    if (Number.isFinite(field) && field > 0) return field;
    return 156;
  };
  const poolTournamentField = (() => {
    const tournamentId = poolConfig.tournamentId||poolConfig.tournament;
    const fieldLimit = Math.min(getTournamentFieldSize(tournamentId), golferCatalog.length);
    // Don't assume rank is contiguous (1..N). Always take the best N by rank.
    return [...golferCatalog]
      .sort((a,b)=>Number(a.rank||9999)-Number(b.rank||9999))
      .slice(0, fieldLimit);
  })();
  const findGolferById = (id) => poolTournamentField.find(x=>x.id===id) || apiGolfers.find(x=>x.id===id);

  const filteredField = poolTournamentField.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const effectiveUserId = apiSession.get()?.id || currentUser;
  const activePoolMemberIds = activePool ? (poolMembers[activePool.id] || []) : [];
  const isHostOfActivePool = String(activePool?.hostId || activePool?.host_id || "") === String(effectiveUserId || "");
  const joinedParticipants = (() => {
    if (!activePool) return participants.filter(p=>p.joined);
    // Preserve backend join order so snake draft turn-taking matches the server.
    const ordered = activePoolMemberIds
      .map((id) => participants.find((p) => String(p.id) === String(id)))
      .filter(Boolean);
    if (ordered.length) return ordered;
    const fallbackUserId = apiSession.get()?.id || currentUser;
    if (!fallbackUserId) return [];
    const me = participants.find((p)=>String(p.id)===String(fallbackUserId));
    return me ? [me] : [];
  })();
  const lobbyVisibleParticipants = poolPhase === "lobby"
    ? joinedParticipants.filter((p) => activeLobbyUserIds.some((id) => String(id) === String(p.id)))
    : joinedParticipants;
  const poolIsFull = !!activePool && joinedParticipants.length >= Number(activePool.maxParticipants || 0);

  // Get picks for active pool (or current draft)
  const activePicks = activePool ? (allDrafted[activePool.id]||[]) : drafted;

  const draftOrderType = activePool?.draftOrderType || config.draftOrderType || "ordered";

  // Build base participant order (randomized if pool uses random order)
  const baseParticipantOrder = (() => {
    const joined = joinedParticipants;
    // For shared drafts, the server turn order is based on join time.
    // Ignore client-only randomized order to prevent mismatched turn UI.
    if (apiToken.get() && activePool?.id) return joined;
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

    // Shared drafts: render-only countdown (server enforces the clock + auto-skip).
    if (apiToken.get() && activePool?.id) {
      clearInterval(timerRef.current);
      // timer is kept in sync with serverTimeRemaining on poll; tick down smoothly between polls.
      if (draftPaused) return () => clearInterval(timerRef.current);
      timerRef.current = setInterval(()=>{
        setTimer(t => (typeof t === "number" ? Math.max(0, t - 1) : sc));
      }, 1000);
      return()=>clearInterval(timerRef.current);
    }

    // Local/demo drafts: client enforces clock + auto-skip.
    setTimer(sc);
    timerRef.current = setInterval(()=>{
      setTimer(t=>{
        if(t<=1){ autoSkip(); return sc; }
        return t-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[currentPick,draftActive,draftDone,draftPaused]);

  const autoSkip = useCallback(()=>{
    const avail = poolTournamentField.filter(g=>!drafted.find(d=>d.golferId===g.id));
    if(avail.length) makePick(avail[0].id,true);
  },[drafted,currentPick,poolTournamentField]);

  const makePick = async (golferId,auto=false) => {
    if(!draftActive||draftDone) return;
    const isShared = !!(activePool?.id && apiToken.get());
    const isMyTurn = !effectiveUserId || String(currentParticipant?.id) === String(effectiveUserId);

    let mode = "pick"; // "pick" | "force"
    if (!auto && !isMyTurn) {
      if (isShared && isHostOfActivePool) {
        const ok = window.confirm(`Force-pick for ${currentParticipant?.name || "current drafter"}?`);
        if (!ok) return;
        mode = "force";
      } else {
        notify("It's not your turn to pick.", "error");
        return;
      }
    }

    if (pickBusyRef.current) return;
    pickBusyRef.current = true;
    setPickBusy(true);
    try {
      if (isShared) {
        if (mode === "force") await Draft.forcePick(activePool.id, golferId);
        else await Draft.pick(activePool.id, golferId);

        const state = await Draft.state(activePool.id);
        const picks = state?.picks || [];
        const mapped = picks.map((p)=>({
          golferId: p.golfer_id,
          participantId: p.user_id,
          pickNum: p.pick_number,
        }));
        setDrafted(mapped);
        setAllDrafted(ad=>({...ad,[activePool.id]:mapped}));
        setCurrentPick(picks.length);
        if (state?.isDone || picks.length >= totalPicks) {
          setDraftDone(true);
          setDraftActive(false);
        }
        return;
      }

      // Local/demo draft
      clearInterval(timerRef.current);
      const pId = baseParticipantOrder[snakeOrder[currentPick]]?.id;
      if (!pId) return;
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
    } catch (e) {
      notify(e?.message || "Pick failed. Refresh and try again.", "error");
    } finally {
      pickBusyRef.current = false;
      setPickBusy(false);
    }
  };

  const startDraft = () => {
    // Shared mode: start draft via server so all clients stay in sync.
    if (apiToken.get() && activePool?.id) {
      if (!isHostOfActivePool) {
        notify("Only the host can start the draft.", "error");
        return;
      }
      (async () => {
        try {
          await Pools.startDraft(activePool.id);
          setPoolPhase("draft");
          setDraftActive(true);
          setDraftDone(false);
          setServerTimeRemaining(null);
        } catch (e) {
          notify(e?.message || "Could not start the draft. Make sure everyone is ready.", "error");
        }
      })();
      return;
    }
    if (poolTournamentField.length === 0) {
      notify("No real tournament field is loaded yet. Seed golfer data first.", "error");
      return;
    }
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
    // Don't show placeholder scores before the tournament starts.
    const tournamentId = activePool?.tournamentId || config.tournamentId || "";
    if (tournamentId && !hasTournamentStarted(tournamentId)) return null;

    const scores = team.map(g=>{
      const ls = sg.find(l=>l.gId===g.id);
      if(!ls) return null;
      const rounds = [ls.R1,ls.R2,ls.R3,ls.R4];
      const hasAny = rounds.some(v => typeof v === "number");
      if (!hasAny) return null;
      return rounds.reduce((sum,v)=>sum+(typeof v==="number"?v:0),0);
    }).sort((a,b)=>a-b);
    const real = scores.filter(v => typeof v === "number");
    if (!real.length) return null;
    return real.slice(0,sc).reduce((s,v)=>s+v,0);
  };

  const standings = joinedParticipants.map(p=>({
    ...p,
    score:getTeamScore(p.id),
    team:getTeam(p.id),
    cutMade:getTeam(p.id).filter(g=>liveScores.find(l=>l.gId===g.id)).length
  })).sort((a,b)=>(a.score ?? 9999)-(b.score ?? 9999));

  const notify = (msg,type="success") => {
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),3000);
  };

  const sendChat = async () => {
    if (!apiToken.get() || !activePool?.id) return;
    if (chatBusy) return;
    const text = chatText.trim();
    if (!text) return;
    setChatBusy(true);
    try {
      await Pools.chatSend(activePool.id, text);
      setChatText("");
      try {
        const resp = await Pools.chatList(activePool.id);
        setChatMessages(Array.isArray(resp?.messages) ? resp.messages : []);
      } catch {}
    } catch (e) {
      notify(e?.message || "Could not send message.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const pingLobby = async () => {
    if (!apiToken.get() || !activePool?.id) return;
    if (chatBusy) return;
    setChatBusy(true);
    try {
      await Pools.chatPing(activePool.id);
      try {
        const resp = await Pools.chatList(activePool.id);
        setChatMessages(Array.isArray(resp?.messages) ? resp.messages : []);
      } catch {}
    } catch (e) {
      notify(e?.message || "Could not ping lobby.", "error");
    } finally {
      setChatBusy(false);
    }
  };

  const pauseDraft = async () => {
    if (!apiToken.get() || !activePool?.id) return;
    try {
      await Draft.pause(activePool.id);
      setDraftPaused(true);
      notify("Draft paused.");
    } catch (e) {
      notify(e?.message || "Could not pause draft.", "error");
    }
  };

  const resumeDraft = async () => {
    if (!apiToken.get() || !activePool?.id) return;
    try {
      await Draft.resume(activePool.id);
      setDraftPaused(false);
      notify("Draft resumed.");
    } catch (e) {
      notify(e?.message || "Could not resume draft.", "error");
    }
  };

  const copyLink = (txt) => {
    navigator.clipboard?.writeText(txt);
    notify("Link copied to clipboard!");
  };

  const getEffectiveUserId = () => apiSession.get()?.id || currentUser;
  const getEffectiveUserName = () => {
    const su = apiSession.get();
    if (su?.name) return su.name;
    const acct = accounts.find(a=>a.id===currentUser);
    return acct?.name || "Account";
  };
  const getEffectiveUserAvatar = () => {
    const su = apiSession.get();
    if (su?.avatar) return su.avatar;
    const acct = accounts.find(a=>a.id===currentUser);
    return acct?.avatar || (getEffectiveUserName().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "AD");
  };
  const getEffectiveUserEmail = () => {
    const su = apiSession.get();
    if (su?.email) return su.email;
    return accounts.find(a=>a.id===currentUser)?.email || "";
  };

  const buildInviteUrl = (pool) => {
    const token = pool?.invite_token || pool?.inviteToken || pool?.id;
    if (!token) return `${SITE_BASE}/`;
    const encoded = encodeInviteData(pool);
    const suffix = encoded ? `?d=${encodeURIComponent(encoded)}` : "";
    return `${SITE_BASE}/join/${encodeURIComponent(token)}${suffix}`;
  };
  const compactInviteUrl = (pool) => {
    const token = pool?.invite_token || pool?.inviteToken || pool?.id || "";
    const short = token.length > 14 ? `${token.slice(0,7)}…${token.slice(-5)}` : token;
    return `${SITE_BASE}/join/${short}`;
  };
  const createFlowInviteUrl = buildInviteUrl({ invite_token: pendingInviteToken });

  const openPool = (pool) => {
    setActivePool(pool);
    if(pool.status==="live") {
      setPoolPhase("live");
      setDraftActive(false);
      setDraftDone(false);
    } else if(pool.status==="draft") {
      setPoolPhase("draft");
      setDraftActive(true);
      setDraftDone(false);
      setServerTimeRemaining(null);
    } else if(pool.status==="complete") {
      setPoolPhase("live");
      setDraftActive(false);
      setDraftDone(false);
    } else {
      setPoolPhase("lobby");
      setDraftActive(false);
      setDraftDone(false);
    }
    setPoolReadyMap({});
    setView("pool");
  };

  const openInvite = (pool) => {
    setInvitePool(pool);
    setInviteView(true);
    setAuthMode((apiToken.get() && (apiSession.get()?.id || currentUser)) ? "join" : "login");
    setAuthName(""); setAuthError(""); setAuthSuccess("");
    setForgotSent(false);
    setInviteJoinRequested(false);
    setView("invite");
  };

  const handleInviteJoinCTA = () => {
    if (!invitePool) return;
    if (authBusy) return;
    setAuthError("");
    setAuthSuccess("");
    setInviteJoinRequested(true);

    // If not authenticated yet, prompt login and focus the email input.
    if (!apiToken.get()) {
      setAuthMode("login");
      setInviteView(true);
      setView("invite");
      setTimeout(() => {
        try { loginEmailRef.current?.focus?.(); } catch {}
      }, 0);
      return;
    }

    // Already authenticated: join immediately.
    setAuthMode("join");
    setInviteView(true);
    setView("invite");
    setTimeout(() => {
      try { handleJoinInvitedPool(); } catch {}
    }, 0);
  };

  const joinPool = (userId, pool) => {
    if(!pool) return;
    // Ensure pool exists locally (important when invite was resolved from backend).
    setPools(ps=>{
      if(ps.find(p=>p.id===pool.id)) return ps;
      return [...ps, {
        ...pool,
        participants: pool.participants || 0,
        maxParticipants: pool.maxParticipants || 8,
        teamSize: pool.teamSize || 4,
        scoringGolfers: pool.scoringGolfers || 2,
        cutLine: pool.cutLine || 2,
        shotClock: pool.shotClock || 60,
        draftOrderType: pool.draftOrderType || "ordered",
        created: pool.created || new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
      }];
    });
    let nextMemberCount = 1;
    // Add user to pool members
    setPoolMembers(m=>{
      const existing = m[pool.id]||[];
      if(existing.some((id)=>String(id)===String(userId))) {
        nextMemberCount = existing.length;
        return m;
      }
      const updatedList = [...existing, userId];
      nextMemberCount = updatedList.length;
      const updated = {...m, [pool.id]:updatedList};
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
    setPools(ps=>ps.map(p=>p.id===pool.id?{...p,participants:Math.max(Number(p.participants||0), nextMemberCount)}:p));
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

  const handleLogin = async () => {
    if (authBusy) return;
    const email = authEmail.trim().toLowerCase();
    const pass = authPass;
    if (!email || !pass) { setAuthError("Email and password are required."); return; }

    setAuthBusy(true);
    try {
      const resp = await Auth.login({ email, password: pass });
      const user = resp?.user;
      if (!user?.id) throw new Error("Invalid login response");
      setCurrentUser(user.id);
      LS.set("mgpp_session", user.id);
      setAuthEmail(email);
      ensureParticipant({ id:user.id, name:user.name || email.split("@")[0], email:user.email || email, avatar:user.avatar || (user.name||"U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() });
      setAuthError("");
      if(invitePool){
        setAuthMode("join");
        setInviteView(true);
        setView("invite");
        setInviteJoinRequested(true);
      } else {
        notify(`Welcome back, ${(user.name || email).split(" ")[0]}!`);
        setView("home");
      }
      return;
    } catch (e) {
      const msg = String(e?.message || "");
      if (/rate limit/i.test(msg)) setAuthError("Too many auth attempts. Wait a few minutes, then try again.");
      else if (/email not confirmed/i.test(msg)) setAuthError("Account setup is still completing. Try again in a few seconds.");
      else setAuthError(msg || "Login failed. Please check your email/password.");
    } finally {
      setAuthPass("");
      setAuthBusy(false);
    }
  };

  const handleSignup = async () => {
    if (authBusy) return;
    if(!authName.trim()||!authEmail.trim()||!authPass){ setAuthError("Please fill all fields."); return; }
    if(authPass.length<6){ setAuthError("Password must be at least 6 characters."); return; }
    const name = authName.trim();
    const email = authEmail.trim().toLowerCase();
    const pass = authPass;

    setAuthBusy(true);
    try {
      const resp = await Auth.signup({ name, email, password: pass });
      const user = resp?.user;
      if (!user?.id) throw new Error("Invalid signup response");
      setCurrentUser(user.id);
      LS.set("mgpp_session", user.id);
      setAuthEmail(email);
      ensureParticipant({ id:user.id, name:user.name || name, email:user.email || email, avatar:user.avatar || name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() });
      setAuthError("");
      if(invitePool){
        setAuthMode("join");
        setInviteView(true);
        setView("invite");
        setInviteJoinRequested(true);
      } else {
        notify(`Welcome to GolfPoolPro, ${name.split(" ")[0]}!`);
        setView("home");
      }
      return;
    } catch (e) {
      const msg = String(e?.message || "");
      if (/rate limit/i.test(msg)) setAuthError("Too many signup emails sent. Wait a few minutes and try again.");
      else setAuthError(msg || "Signup failed. Please try again.");
    } finally {
      setAuthPass("");
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (authBusy) return;
    const email = authEmail.trim().toLowerCase();
    if(!email){ setAuthError("Enter your email above first."); return; }
    setAuthBusy(true);
    try {
      await Auth.forgotPassword(email);
      setForgotSent(true);
      setAuthError("");
      setAuthSuccess("Password reset email sent. Check your inbox.");
      notify("Password reset email sent!");
    } catch (e) {
      const msg = String(e?.message || "");
      if (/rate limit/i.test(msg)) setAuthError("Reset email rate limit reached. Wait a few minutes and try again.");
      else setAuthError(msg || "Could not send reset email. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPasswordFromLink = async () => {
    if (authBusy) return;
    if (!resetPass || resetPass.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (resetPass !== resetPassConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (!apiToken.get()) {
      setAuthError("Reset link is invalid or expired. Request a new reset link.");
      setAuthMode("forgot");
      return;
    }
    setAuthBusy(true);
    try {
      await Auth.resetPassword(resetPass);
      setAuthError("");
      setAuthSuccess("Password updated. You can now log in.");
      setResetPass("");
      setResetPassConfirm("");
      try { apiToken.clear(); } catch {}
      setAuthMode("login");
    } catch (e) {
      const msg = String(e?.message || "");
      if (/expired|invalid|401|403/i.test(msg)) {
        setAuthError("This reset link expired. Request a new one.");
        setAuthMode("forgot");
      } else {
        setAuthError(msg || "Could not update password. Try again.");
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try { await Auth.logout(); } catch {}
    setCurrentUser(null);
    setShowUserMenu(false);
    setShowSettings(false);
    setActivePool(null);
    setInvitePool(null);
    setInviteView(false);
    setAuthMode("login");
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

  const handleJoinInvitedPool = async () => {
    const userId = getEffectiveUserId();
    if (!userId || !invitePool) return;
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (!apiToken.get()) {
        setAuthError("Please log in to your account, then join the pool.");
        setAuthMode("login");
        return;
      }
      try {
        const me = await Auth.me();
        const meId = me?.user?.id;
        if (!meId) throw new Error("No active session");
        if (String(meId) !== String(userId)) {
          setCurrentUser(meId);
          LS.set("mgpp_session", meId);
        }
      } catch {
        setAuthError("Your session expired. Please log in again.");
        setAuthMode("login");
        return;
      }
      // Try backend join when we have a real invite token/session; local-mode fallback below.
      const token = invitePool.invite_token || invitePool.inviteToken || null;
      let joinedPoolId = invitePool.id;
      if (token) {
        try {
          const joined = await Invites.join(token);
          joinedPoolId = joined?.poolId || joinedPoolId;
        } catch (e) {
          throw e;
        }
      }
      if (!joinedPoolId) throw new Error("Unable to resolve pool ID from invite.");
      let details = null;
      try {
        details = await Pools.get(joinedPoolId);
      } catch (detailsErr) {
        // Keep join flow resilient: if details fetch fails, still route to lobby with invite data.
        console.warn("Pool details fetch failed after join; using invite fallback:", detailsErr?.message || detailsErr);
      }
      const bp = details?.pool || {};
      const mappedPool = {
        id: bp.id || invitePool.id,
        name: bp.name || invitePool.name,
        status: bp.status || invitePool.status || "lobby",
        tournamentId: bp.tournament_id || invitePool.tournamentId || "",
        tournamentName: bp.tournament?.name || invitePool.tournamentName || "",
        participants: (details?.members || []).length || invitePool.participants || 0,
        maxParticipants: Number(bp.max_participants || invitePool.maxParticipants || 8),
        teamSize: Number(bp.team_size || invitePool.teamSize || 4),
        scoringGolfers: Number(bp.scoring_golfers || invitePool.scoringGolfers || 2),
        cutLine: Number(bp.cut_line || invitePool.cutLine || 2),
        shotClock: Number(bp.shot_clock || invitePool.shotClock || 60),
        invite_token: bp.invite_token || token || invitePool.invite_token,
        hostId: bp.host_id || invitePool.hostId || null,
      };
      joinPool(userId, mappedPool);
      setActivePool(mappedPool);
      const phase = mappedPool.status==="live" ? "live" : mappedPool.status==="draft" ? "draft" : "lobby";
      setPoolPhase(phase);
      setDraftActive(phase === "draft");
      setDraftDone(false);
      if (phase === "draft") setServerTimeRemaining(null);
      setView("pool");
      setInviteView(false);
      setAuthSuccess("");
      setInviteJoinRequested(false);
      clearInviteRouteFromLocation();
      notify(`Joined ${mappedPool.name}!`);
    } catch (e) {
      const msg = String(e?.message || "");
      if (/expired|unauthorized|invalid|401|403/i.test(msg)) {
        try { apiToken.clear(); } catch {}
        setAuthMode("login");
        setAuthError("Your session expired. Please log in again, then join the pool.");
      } else {
        setAuthError(msg || "Could not join this pool right now. Please try again.");
        setInviteJoinRequested(false);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // If a user initiated join from an invite but had to authenticate first,
  // automatically complete the join as soon as auth is available.
  useEffect(() => {
    if (!inviteJoinRequested) return;
    if (!invitePool) return;
    if (authBusy) return;
    if (!apiToken.get()) return;
    handleJoinInvitedPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteJoinRequested, invitePool, authBusy]);

  // Stats helpers
  const getPlayerRounds = (gId) => {
    const ls = liveScores.find(l=>l.gId===gId);
    if(!ls) return [];
    return [1,2,3,4].map(r=>{
      const birdies=ls.birdies[r-1]||0;
      const eagles=ls.eagles[r-1]||0;
      const bogeys=ls.bogeys[r-1]||0;
      const played=birdies+eagles+bogeys>0;
      return {
        round:`R${r}`,
        score:ls[`R${r}`],
        birdies,
        eagles,
        bogeys,
        pars:played?18-birdies-eagles-bogeys:0,
      };
    }).filter(r=>r.score!==null&&r.score!==undefined);
  };

  const getSGData = (gId) => {
    // Try to derive radar data from real API golfer stats
    const golfer = apiGolfers.find(g => g.id === gId);
    if (golfer && (golfer.drivDist || golfer.drivAcc || golfer.gir || golfer.putts || golfer.sg)) {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const drivDistVal = golfer.drivDist ? clamp((golfer.drivDist - 270) / 20, -0.5, 2) : 0;
      const drivAccVal  = golfer.drivAcc  ? clamp((golfer.drivAcc - 55) / 15, -0.5, 2)  : 0;
      const girVal      = golfer.gir      ? clamp((golfer.gir - 60) / 15, -0.5, 2)      : 0;
      const puttsVal    = golfer.putts     ? clamp((30 - golfer.putts) / 2, -0.5, 2)     : 0;
      const sgVal       = golfer.sg != null ? golfer.sg : 0;
      const data = [
        { stat: "Drive Dist", value: drivDistVal, fullMark: 2.0 },
        { stat: "Drive Acc",  value: drivAccVal,  fullMark: 2.0 },
        { stat: "GIR",        value: girVal,       fullMark: 2.0 },
        { stat: "Putting",    value: puttsVal,     fullMark: 2.0 },
        { stat: "SG Total",   value: sgVal,        fullMark: 2.0 },
      ];
      // Only return if at least one value is non-zero
      if (data.some(d => d.value !== 0)) return data;
    }
    // Fallback to legacy demo SG_DATA for seed golfer IDs
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
  const lobbyReadyCount = lobbyVisibleParticipants.filter((p) => !!poolReadyMap[p.id]).length;

  // Auto-launch when all ready
  useEffect(()=>{
    // Only the host should trigger a shared draft start; other clients will transition
    // when the backend pool status flips to "draft".
    if(allReady && poolPhase==="lobby" && view==="pool" && isHostOfActivePool){
      // Shared drafts allow solo pools for testing.
      const t = setTimeout(()=>{ startDraft(); }, 1500);
      return ()=>clearTimeout(t);
    }
  },[allReady, poolPhase, view, isHostOfActivePool, joinedParticipants.length]);

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
            <button className="nav-home-btn" type="button" onClick={()=>{setView("home");setActivePool(null);}} aria-label="Home">
              Home
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}} ref={userMenuRef}>
              <button
                type="button"
                className="nav-user"
                aria-haspopup="menu"
                aria-expanded={showUserMenu}
                onClick={()=>setShowUserMenu(v=>!v)}
              >
                <Avatar init={effectiveUserId ? (getEffectiveUserAvatar()||"AD") : "AD"} size={24} color="var(--gold)"/>
                <span>{effectiveUserId ? (getEffectiveUserName()||"Account").split(" ")[0] : "Guest"}</span>
              </button>
              {showUserMenu && (
                <div style={{position:"absolute",top:42,right:0,minWidth:170,background:"#133526",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,boxShadow:"0 12px 28px rgba(0,0,0,.35)",overflow:"hidden",zIndex:450}}>
                  <button
                    type="button"
                    onClick={()=>{
                      setShowUserMenu(false);
                      setShowSettings(true);
                      setPasswordMsg("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    style={{display:"block",width:"100%",textAlign:"left",padding:"11px 12px",background:"transparent",border:"none",color:"rgba(255,255,255,.88)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={()=>{ setShowUserMenu(false); handleLogout(); }}
                    style={{display:"block",width:"100%",textAlign:"left",padding:"11px 12px",background:"transparent",border:"none",color:"#FCA5A5",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",borderTop:"1px solid rgba(255,255,255,.08)"}}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </nav>
          {/* ──────── SETTINGS PANEL ──────── */}
          {showSettings && (()=>{
            const user = participants.find(p=>p.id===getEffectiveUserId()) || {name:getEffectiveUserName(),avatar:getEffectiveUserAvatar(),email:getEffectiveUserEmail()};
            const account = accounts.find(a=>a.id===currentUser) || {email:getEffectiveUserEmail()};
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
                      onClick={async()=>{
                        if(!newPassword) return setPasswordMsg("Please enter a new password.");
                        if(newPassword.length<6) return setPasswordMsg("Password must be at least 6 characters.");
                        if(newPassword!==confirmPassword) return setPasswordMsg("Passwords don't match.");
                        try{
                          await Auth.updatePassword(newPassword);
                          setPasswordMsg("✓ Password updated successfully!");
                          setNewPassword(""); setConfirmPassword("");
                          setTimeout(()=>setPasswordMsg(""),3000);
                        }catch(err){
                          setPasswordMsg(err?.message||"Failed to update password. Please try again.");
                        }
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
                <img className="hero-logo" src="/logo-primary-dark-current.png" alt="GolfPoolPro" />
              </div>
            </div>
            <div className="page">
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",marginBottom:24}}>
                <button className="btn btn-prim" onClick={()=>setView("admin")}>+ New Pool</button>
              </div>
	              <div className="g3" style={{marginBottom:40}}>
	                {pools.map(pool=>{
	                  const t = tournaments.find(x=>x.id===pool.tournamentId);
	                  const started = (() => {
	                    const iso = t?.start_date;
	                    if (!iso) return false;
	                    const d = new Date(iso);
	                    if (Number.isNaN(d.getTime())) return false;
	                    return Date.now() >= d.getTime();
	                  })();
	                  const displayStatus = (pool.status === "live" && !started) ? "drafted" : pool.status;
	                  return (
	                    <div key={pool.id} className={`pool-card ${pool.status}`} onClick={()=>openPool(pool)}>
	                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
	                        <h3 className="h4">{pool.name}</h3>
	                        <span className={`badge ${displayStatus==="live"?"bg-red":displayStatus==="lobby"?"bg-gold":displayStatus==="complete"?"bg-gray":"bg-forest"}`}>
	                          {displayStatus==="live"&&<span className="live-dot"/>}
	                          {displayStatus==="drafted" ? "Drafted" : (displayStatus.charAt(0).toUpperCase()+displayStatus.slice(1))}
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
	                  {(() => {
	                    const t = tournaments.find((x)=>x.id===activePool.tournamentId);
	                    const iso = t?.start_date;
	                    const started = (() => {
	                      if (!iso) return false;
	                      const d = new Date(iso);
	                      if (Number.isNaN(d.getTime())) return false;
	                      return Date.now() >= d.getTime();
	                    })();
	                    const displayStatus = (activePool.status === "live" && !started) ? "drafted" : activePool.status;
	                    const showLabel = poolPhase==="draft" ? "Drafting" : (displayStatus==="drafted" ? "Drafted" : (displayStatus.charAt(0).toUpperCase()+displayStatus.slice(1)));
	                    const cls = displayStatus==="live" ? "bg-red" : displayStatus==="lobby" ? "bg-gold" : displayStatus==="drafted" ? "bg-forest" : "bg-gray";
	                    return (
	                      <span className={`badge ${cls}`}>
	                        {displayStatus==="live"&&<span className="live-dot"/>}
	                        {showLabel}
	                      </span>
	                    );
	                  })()}
	                </div>
	                <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{tournaments.find(t=>t.id===activePool.tournamentId)?.name}</p>
	              </div>
	              {(() => {
	                const t = tournaments.find((x)=>x.id===activePool.tournamentId);
	                const iso = t?.start_date;
	                const started = (() => {
	                  if (!iso) return false;
	                  const d = new Date(iso);
	                  if (Number.isNaN(d.getTime())) return false;
	                  return Date.now() >= d.getTime();
	                })();
	                if (!started) return null;
	                if (!(activePool.status==="live"||poolPhase==="live")) return null;
	                return (
	                <div className="update-bar" style={{background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",margin:0}}>
	                  <div className="pulse-dot"/>
	                  <span>Live · updates in {Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")} · {lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
	                </div>
	                );
	              })()}
              {/* Delete button — host only */}
              {isHostOfActivePool && (
                confirmDelete ? (
                  <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(220,38,38,.15)",border:"1px solid rgba(220,38,38,.4)",borderRadius:10,padding:"8px 12px"}}>
                    <span style={{fontSize:12,color:"#FCA5A5",fontWeight:600}}>Delete this pool?</span>
                    <button onClick={async ()=>{
                      if (deleteBusy || !activePool?.id) return;
                      const deletedId = activePool.id;
                      setDeleteBusy(true);
                      try {
                        if (!apiToken.get()) throw new Error("Session expired. Please log in again.");
                        await Pools.delete(deletedId);

                        setPools(ps=>ps.filter(p=>p.id!==deletedId));
                        setPoolMembers((m) => {
                          const copy = { ...m };
                          delete copy[deletedId];
                          return copy;
                        });
                        setAllDrafted((d) => {
                          const copy = { ...d };
                          delete copy[deletedId];
                          return copy;
                        });
                        setPoolReadyMap({});

                        try {
                          const cachedPools = LS.get("mgpp_pools", []).filter((p) => p.id !== deletedId);
                          LS.set("mgpp_pools", cachedPools);
                          const cachedMembers = LS.get("mgpp_members", {});
                          delete cachedMembers[deletedId];
                          LS.set("mgpp_members", cachedMembers);
                          const cachedPicks = LS.get("mgpp_picks", {});
                          delete cachedPicks[deletedId];
                          LS.set("mgpp_picks", cachedPicks);
                        } catch {}

                        const resp = await Pools.list();
                        const mapped = (resp?.pools || []).map((p) => ({
                          id: p.id,
                          name: p.name,
                          status: p.status || "lobby",
                          tournamentId: p.tournament?.id || p.tournament_id || "",
                          tournamentName: p.tournament?.name || "",
                          participants: Number(p.participants || 0),
                          maxParticipants: Number(p.max_participants || p.maxParticipants || 8),
                          teamSize: Number(p.team_size || p.teamSize || 4),
                          scoringGolfers: Number(p.scoring_golfers || p.scoringGolfers || 2),
                          cutLine: Number(p.cut_line || p.cutLine || 2),
                          shotClock: Number(p.shot_clock || p.shotClock || 60),
                          draftOrderType: p.draft_order_type || p.draftOrderType || "ordered",
                          invite_token: p.invite_token || null,
                          hostId: p.host_id || null,
                          yourRank: p.yourRank ?? null,
                          yourScore: p.yourScore ?? null,
                          created: p.created_at ? new Date(p.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
                        }));
                        if (mapped.some((p) => p.id === deletedId)) {
                          throw new Error("Server still returned this pool after deletion. Please refresh and try again.");
                        }
                        setPools(mapped);

                        setActivePool(null);
                        setView("home");
                        setConfirmDelete(false);
                        notify("Pool deleted.","success");
                      } catch (e) {
                        notify(e?.message || "Could not delete pool.", "error");
                      } finally {
                        setDeleteBusy(false);
                      }
                    }} disabled={deleteBusy} style={{padding:"4px 12px",borderRadius:7,border:"none",background:"#DC2626",color:"#fff",fontSize:12,fontWeight:700,cursor:deleteBusy?"not-allowed":"pointer",opacity:deleteBusy?0.75:1}}>
                      {deleteBusy ? "Deleting..." : "Yes, Delete"}
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
                    <p style={{color:"rgba(255,255,255,.7)",fontSize:14}}>
                      {lobbyReadyCount}/{lobbyVisibleParticipants.length} currently in lobby
                      {allReady?" · Launching draft…":""}
                    </p>
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
                      {lobbyVisibleParticipants.map(p=>{
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
                            {isHostOfActivePool && String(p.id) !== String(activePool.hostId) && activePool.status==="lobby" && (
                              <button
                                className="btn-ghost"
                                style={{fontSize:11,padding:"6px 10px",borderRadius:9,border:"1px solid rgba(220,38,38,.25)",background:"rgba(220,38,38,.08)",color:"#B91C1C",fontWeight:700,cursor:"pointer"}}
                                onClick={async ()=>{
                                  const ok = window.confirm(`Remove ${p.name} from this pool?`);
                                  if (!ok) return;
                                  try {
                                    await Pools.removeMember(activePool.id, p.id);
                                    // Refresh members/presence quickly.
                                    try {
                                      const resp = await Pools.get(activePool.id);
                                      const members = resp?.members || [];
                                      setPoolMembers((prev) => ({ ...prev, [activePool.id]: members.map((m) => m.user_id) }));
                                      setPoolReadyMap((prev) => ({ ...prev, ...Object.fromEntries(members.map((m) => [m.user_id, !!m.is_ready])) }));
                                      setActiveLobbyUserIds(Array.isArray(resp?.activeLobbyUserIds) ? resp.activeLobbyUserIds : []);
                                    } catch {}
                                    notify("Participant removed.");
                                  } catch (e) {
                                    notify(e?.message || "Could not remove participant.", "error");
                                  }
                                }}>
                                Remove
                              </button>
                            )}
                            {!isReady && String(p.id) === String(effectiveUserId) && (
                              <button
                                className="btn-ready"
                                disabled={!!readyBusyMap[p.id]}
                                style={readyBusyMap[p.id] ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                                onClick={async ()=>{
                                if (readyBusyMap[p.id]) return;
                                setReadyBusyMap((m) => ({ ...m, [p.id]: true }));
                                try {
                                  const uid = apiSession.get()?.id || currentUser;
                                  if (apiToken.get() && activePool?.id && String(uid) === String(p.id)) {
                                    try {
                                      await Pools.setReady(activePool.id, true);
                                      setPoolReadyMap(m=>({...m,[p.id]:true}));
                                      return;
                                    } catch {}
                                  }
                                  setPoolReadyMap(m=>({...m,[p.id]:true}));
                                } finally {
                                  setReadyBusyMap((m) => ({ ...m, [p.id]: false }));
                                }
                              }}>
                                {readyBusyMap[p.id] ? "Saving..." : "Ready"}
                              </button>
                            )}
                            {!isReady && String(p.id) !== String(effectiveUserId) && (
                              <span style={{fontSize:11,color:"var(--muted)"}}>Waiting</span>
                            )}
                            {isReady && <span style={{fontSize:20}}>✅</span>}
                          </div>
                        );
                      })}
                      {lobbyVisibleParticipants.length === 0 && (
                        <div className="card" style={{gridColumn:"1 / -1",padding:"14px 16px"}}>
                          <p style={{fontSize:13,color:"var(--muted)"}}>No one is actively in this lobby right now.</p>
                        </div>
                      )}
                    </div>
                    {!allReady && isHostOfActivePool && (
                      <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={async ()=>{
                        if (apiToken.get() && activePool?.id) {
                          try {
                            await Pools.readyAll(activePool.id);
                            // Let the normal pool sync pick up ready + status changes quickly.
                            try {
                              const resp = await Pools.get(activePool.id);
                              const members = resp?.members || [];
                              setPoolReadyMap((prev) => ({
                                ...prev,
                                ...Object.fromEntries(members.map((m) => [m.user_id, !!m.is_ready])),
                              }));
                            } catch {}
                            notify("Everyone marked ready.");
                          } catch (e) {
                            notify(e?.message || "Could not mark everyone ready.", "error");
                          }
                          return;
                        }
                        // Local/demo fallback
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
                      {poolIsFull ? (
                        <p className="sub" style={{marginBottom:0,fontSize:13}}>
                          Pool is full ({joinedParticipants.length}/{activePool.maxParticipants}). Invite link is unavailable.
                        </p>
                      ) : (
                        <>
                          <p className="sub" style={{marginBottom:12,fontSize:13}}>Share this link so others can log in or create an account to join.</p>
                          <div className="link-box" style={{marginBottom:10}}>
                            <span className="link-txt" title={buildInviteUrl(activePool)}>{compactInviteUrl(activePool)}</span>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>copyLink(buildInviteUrl(activePool))}>Copy</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="card" style={{marginTop:16}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                        <h4 className="h4" style={{marginBottom:0}}>Lobby Chat</h4>
                        {isHostOfActivePool && (
                          <button className="btn btn-ghost btn-sm" onClick={pingLobby} disabled={chatBusy}>
                            {chatBusy ? "…" : "Ping all"}
                          </button>
                        )}
                      </div>
                      <div style={{height:220,overflowY:"auto",padding:"10px 12px",background:"var(--cream)",borderRadius:10,border:"1px solid var(--cream-2)"}}>
                        {chatMessages.length===0 && (
                          <p style={{fontSize:12,color:"var(--muted)"}}>No messages yet.</p>
                        )}
                        {chatMessages.map((m)=>{
                          const who = participants.find(p=>String(p.id)===String(m.user_id));
                          const name = m.type==="ping" ? "System" : (who?.name || "Player");
                          const isMe = String(m.user_id)===String(effectiveUserId) && m.type==="chat";
                          const ts = m.ts ? new Date(m.ts) : null;
                          return (
                            <div key={m.id} style={{marginBottom:8,display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
                              <div style={{
                                maxWidth:"85%",
                                padding:"8px 10px",
                                borderRadius:12,
                                background: m.type==="ping" ? "rgba(200,169,79,.14)" : (isMe ? "rgba(27,67,50,.12)" : "#fff"),
                                border: m.type==="ping" ? "1px solid rgba(200,169,79,.35)" : "1px solid rgba(27,67,50,.08)",
                              }}>
                                <div style={{display:"flex",gap:8,alignItems:"baseline",marginBottom:2}}>
                                  <span style={{fontSize:11,fontWeight:800,color:m.type==="ping"?"#7A5C00":"var(--forest)"}}>{name}</span>
                                  {ts && <span style={{fontSize:10,color:"var(--muted)"}}>{ts.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
                                </div>
                                <div style={{fontSize:13,color:"var(--text)",whiteSpace:"pre-wrap"}}>{m.text}</div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef}/>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <input
                          className="inp"
                          value={chatText}
                          placeholder="Message the lobby…"
                          onChange={(e)=>setChatText(e.target.value)}
                          onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); } }}
                        />
                        <button className="btn btn-prim" onClick={sendChat} disabled={chatBusy || !chatText.trim()}>
                          Send
                        </button>
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
                {!apiToken.get() && !draftActive && !draftDone && (
                  <div style={{textAlign:"center",padding:"80px 40px"}}>
                    <p style={{fontSize:56,marginBottom:16}}>🏌️</p>
                    <h2 className="h2" style={{marginBottom:10}}>Ready to Draft</h2>
                    <p className="sub" style={{marginBottom:28}}>{poolTournamentField.length} golfers available · Best {activePool.scoringGolfers} of {activePool.teamSize} count</p>
                    {poolTournamentField.length===0 && (
                      <p style={{fontSize:13,color:"var(--red)",marginBottom:14}}>
                        No live field is loaded for this tournament yet.
                      </p>
                    )}
                    <button className="btn btn-gold" style={{fontSize:16,padding:"14px 32px"}} onClick={startDraft} disabled={poolTournamentField.length===0}>Start Draft →</button>
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
                          {apiToken.get() && isHostOfActivePool && (
                            <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:10}}>
                              {!draftPaused ? (
                                <button className="btn btn-ghost btn-sm" onClick={pauseDraft}>Pause</button>
                              ) : (
                                <button className="btn btn-gold btn-sm" onClick={resumeDraft}>Resume</button>
                              )}
                            </div>
                          )}
                          {(()=>{
                            // Preview the next few drafters based on the same snakeOrder logic used for turn-taking.
                            if (!draftActive || draftDone) return null;
                            const upcoming = snakeOrder
                              .slice(currentPick + 1, currentPick + 6)
                              .map((idx) => baseParticipantOrder[idx])
                              .filter(Boolean);
                            if (!upcoming.length) return null;
                            return (
                              <div style={{marginTop:10,width:"100%"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                  <span style={{fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:700,letterSpacing:"0.4px",textTransform:"uppercase"}}>Next {upcoming.length}</span>
                                  <span style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>picks</span>
                                </div>
                                <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                                  {upcoming.map((p) => (
                                    <div key={p.id} title={p.name}
                                      style={{
                                        display:"flex",
                                        alignItems:"center",
                                        justifyContent:"center",
                                        width:28,
                                        height:28,
                                        borderRadius:9,
                                        background:"rgba(255,255,255,.10)",
                                        border:"1px solid rgba(255,255,255,.12)",
                                        color:"#fff",
                                        fontSize:11,
                                        fontWeight:800,
                                      }}>
                                      {p.avatar || (p.name||"P").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
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
                        {(() => {
                          const isMyTurn = draftActive && !draftDone && !draftPaused && (!effectiveUserId || String(currentParticipant?.id) === String(effectiveUserId));
                          const canHostForce = !!(apiToken.get() && activePool?.id && isHostOfActivePool);
                          const canClick = draftActive && !draftDone && !draftPaused && !pickBusy && (isMyTurn || canHostForce);
                          const avail = filteredField.filter(g=>!drafted.find(d=>d.golferId===g.id));

                          if (!avail.length) {
                            return (
                              <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:"40px 0"}}>
                                No available players found
                              </p>
                            );
                          }

                          return avail.map((g)=>(
                            <div
                              key={g.id}
                              className={`pick-row ${canClick ? "" : "disabled"}`}
                              onClick={()=>canClick && makePick(g.id)}
                              title={!canClick ? (pickBusy ? "Pick in progress..." : (draftPaused ? "Draft is paused." : (isMyTurn ? "Waiting..." : "Not your turn."))) : "Draft this player"}
                            >
                              <div style={{width:26,height:26,borderRadius:7,background:"var(--forest)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>
                                {g.rank}
                              </div>
                              <div style={{flex:1}}>
                                <p style={{fontSize:13,fontWeight:600,lineHeight:1.2}}>{g.country} {g.name}</p>
                                <p style={{fontSize:11,color:"var(--muted)"}}>Avg {g.avg} · SG {g.sg>0?"+":""}{g.sg}</p>
                              </div>
                              <p style={{fontSize:12,fontWeight:700,color:"var(--forest)",flexShrink:0}}>{g.drivDist} yds</p>
                            </div>
                          ));
                        })()}
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
	              const started = hasTournamentStarted(activePool.tournamentId);

	              // Before the tournament starts, show a "Drafted" view with teams only.
	              if (!started) {
	                const poolPicks = allDrafted[activePool.id] || [];
	                const poolField = poolTournamentField;
	                const draftedGolferIds = new Set(poolPicks.map(p=>p.golferId));
	                const poolGolfers = poolField.filter(g=>draftedGolferIds.has(g.id));
	                const getPoolTeam = (pId) =>
	                  poolPicks.filter(d=>d.participantId===pId)
	                    .map(d=>poolField.find(g=>g.id===d.golferId)).filter(Boolean);

	                const t = tournaments.find((x)=>x.id===activePool.tournamentId);
	                return (
	                  <div className="page">
	                    <div className="card" style={{padding:18,marginBottom:16}}>
	                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
	                        <div>
	                          <p style={{fontSize:12,fontWeight:800,letterSpacing:".6px",textTransform:"uppercase",color:"var(--muted)"}}>Drafted</p>
	                          <p style={{fontWeight:800,fontSize:16,color:"var(--forest)",marginTop:4}}>Waiting for tournament to start</p>
	                          <p style={{fontSize:12,color:"var(--muted)",marginTop:4}}>
	                            {t?.name || "Tournament"} starts {t?.date || "soon"}.
	                          </p>
	                        </div>
	                        <div style={{textAlign:"right"}}>
	                          <div style={{fontSize:12,color:"var(--muted)"}}>Golfers drafted</div>
	                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"var(--gold)",lineHeight:1}}>
	                            {poolGolfers.length}
	                          </div>
	                        </div>
	                      </div>
	                    </div>

	                    <div className="g2">
	                      {joinedParticipants.map((p)=> {
	                        const team = getPoolTeam(p.id);
	                        return (
	                          <div key={p.id} className="card" style={{padding:16}}>
	                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
	                              <Avatar init={p.avatar} size={34} color="var(--forest)"/>
	                              <div style={{flex:1}}>
	                                <div style={{fontWeight:800,color:"var(--forest)"}}>{p.name}</div>
	                                <div style={{fontSize:12,color:"var(--muted)"}}>{team.length}/{activePool.teamSize} golfers</div>
	                              </div>
	                            </div>
	                            {team.map((g,gi)=>(
	                              <div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:gi? "1px solid var(--cream-2)" : "none"}}>
	                                <span style={{fontSize:12,fontWeight:700,color:"var(--muted)"}}>#{g.rank}</span>
	                                <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>{g.name}</span>
	                              </div>
	                            ))}
	                            {!team.length && <div style={{fontSize:12,color:"var(--muted)"}}>No picks yet.</div>}
	                          </div>
	                        );
	                      })}
	                    </div>
	                  </div>
	                );
	              }

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
	                  if (!ls) return null;
	                  const rounds = [ls.R1,ls.R2,ls.R3,ls.R4];
	                  const hasAny = rounds.some(v => typeof v === "number");
	                  if (!hasAny) return null;
	                  return rounds.reduce((sum,v)=>sum+(typeof v==="number"?v:0),0);
	                }).sort((a,b)=>a-b);
	                const real = scores.filter(v => typeof v === "number");
	                if (!real.length) return null;
	                return real.slice(0,sc).reduce((s,v)=>s+v,0);
	              };

              // All golfers drafted in this pool (for pool-specific stats)
              const draftedGolferIds = new Set(poolPicks.map(p=>p.golferId));
              const poolGolfers = poolField.filter(g=>draftedGolferIds.has(g.id));

              const poolStandings = joinedParticipants.map(p=>({
                ...p,
                team: getPoolTeam(p.id),
              })).map((p) => {
                const teamRows = (p.team || []).map((g) => {
                  const ls = liveScores.find((l) => l.gId === g.id);
                  const rounds = ls ? [ls.R1, ls.R2, ls.R3, ls.R4] : [null, null, null, null];
                  const playedRounds = rounds.filter((v) => v !== null && v !== undefined).length;
                  const playedSum = rounds.filter((v) => v !== null && v !== undefined).reduce((a, b) => a + b, 0);
                  const tot = ls ? (ls.R1 + ls.R2 + ls.R3 + ls.R4) : null;
                  const birdies = ls?.birdies ? ls.birdies.reduce((a, b) => a + b, 0) : 0;
                  const eagles = ls?.eagles ? ls.eagles.reduce((a, b) => a + b, 0) : 0;
                  return { g, ls, tot, playedRounds, playedSum, birdies, eagles };
                }).filter((r) => r.ls && r.tot !== null);

                const cutMade = teamRows.length;
                const eligible = cutMade >= activePool.cutLine;

                const scCount = activePool.scoringGolfers;
                const bestRows = [...teamRows].sort((a, b) => (a.tot ?? 999999) - (b.tot ?? 999999)).slice(0, scCount);
                const bestTotals = bestRows.map((r) => r.tot ?? 999999);
                const score = eligible ? bestTotals.reduce((s, v) => s + v, 0) : null;
                const bonusBirdies = bestRows.reduce((s, r) => s + (r.birdies || 0), 0);
                const bonusEagles = bestRows.reduce((s, r) => s + (r.eagles || 0), 0);

                const bestPlayedRounds = bestRows.reduce((s, r) => s + (r.playedRounds || 0), 0);
                const bestPlayedSum = bestRows.reduce((s, r) => s + (r.playedSum || 0), 0);
                const roundsLeft = Math.max(0, (4 * scCount) - bestPlayedRounds);
                const avgPerRound = bestPlayedRounds > 0 ? (bestPlayedSum / bestPlayedRounds) : 0;
                const projected = eligible ? Math.round(bestPlayedSum + (avgPerRound * roundsLeft)) : null;

                return { ...p, score, projected, eligible, cutMade, bestTotals, bonusBirdies, bonusEagles };
              }).sort((a, b) => {
                if (!!a.eligible !== !!b.eligible) return a.eligible ? -1 : 1;
                const as = a.score ?? 999999999;
                const bs = b.score ?? 999999999;
                if (as !== bs) return as - bs;
                const al = a.bestTotals || [];
                const bl = b.bestTotals || [];
                const len = Math.max(al.length, bl.length, activePool.scoringGolfers);
                for (let i = 0; i < len; i++) {
                  const av = al[i] ?? 999999999;
                  const bv = bl[i] ?? 999999999;
                  if (av !== bv) return av - bv;
                }
                if ((a.bonusEagles || 0) !== (b.bonusEagles || 0)) return (b.bonusEagles || 0) - (a.bonusEagles || 0);
                if ((a.bonusBirdies || 0) !== (b.bonusBirdies || 0)) return (b.bonusBirdies || 0) - (a.bonusBirdies || 0);
                return String(a.name || "").localeCompare(String(b.name || ""));
              });

              return (
              <div className="page">
                <div className="update-bar">
                  <div className="pulse-dot"/>
                  <span>Live scores · refreshing every {SCORE_REFRESH_SECONDS}s · Last updated {lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})} · Next in {countdown}s</span>
                </div>

                {/* Pool standings header cards — uses poolStandings with real scores */}
                <div className="g4" style={{marginBottom:20}}>
	                  {poolStandings.slice(0,4).map((p,i)=>{
	                    const teamScores = p.team.map(g=>{
	                      const ls=liveScores.find(l=>l.gId===g.id);
	                      return {g, tot: sumRounds(ls)};
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
	                      .map(s=>({...s,tot:sumRounds(s)}))
	                      .sort((a,b)=>(a.tot??999999999)-(b.tot??999999999))
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
	                      const teamWithTot = p.team.map(g=>{
	                        const ls=liveScores.find(l=>l.gId===g.id);
	                        const tot=sumRounds(ls);
	                        return { g, tot, ls };
	                      });
                      const countingIds = new Set(
                        teamWithTot
                          .filter(x=>x.tot!==null)
                          .sort((a,b)=>a.tot-b.tot)
                          .slice(0, sc)
                          .map(x=>x.g.id)
                      );
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
                              {p.projected!==null && p.projected!==undefined && (
                                <p style={{fontSize:11,color:"var(--muted)"}}>proj {fmtScore(p.projected)}</p>
                              )}
                            </div>
                          </div>
                          {teamWithTot.map(({g, tot},gi)=>{
                            const isCounting = countingIds.has(g.id);
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
                            <span style={{fontWeight:700,color:p.eligible?"var(--green)":"var(--red)"}}>{p.eligible?"✓ Eligible":"✗ Out"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {poolTab==="chart" && (()=>{
                  // Determine which rounds have actual data
                  const roundKeys=["R1","R2","R3","R4"];
                  const playedRounds=roundKeys.filter(rk=>liveScores.some(s=>typeof s[rk]==="number"));
                  const chartData=playedRounds.map((r,ri)=>({
                    round:r,
                    ...poolStandings.map(p=>({
                      [p.name.split(" ")[0]]:p.team.map(g=>{
                        const ls=liveScores.find(l=>l.gId===g.id);
                        if(!ls) return 0;
                        return playedRounds.slice(0,ri+1).map(rk=>ls[rk]).filter(v=>typeof v==='number').reduce((a,b)=>a+b,0);
                      }).sort((a,b)=>a-b).slice(0,sc).reduce((a,b)=>a+b,0)
                    })).reduce((a,b)=>({...a,...b}),{})
                  }));
                  return (
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Pool Standings — Round by Round</h3>
                    <p className="sub" style={{marginBottom:18}}>Cumulative best-{sc} score progression (lower = better)</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart margin={{top:5,right:10,bottom:0,left:0}} data={chartData}>
                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                        <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                        <Tooltip content={<CTooltip/>}/>
                        {poolStandings.map((p,i)=>(
                          <Line key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} strokeWidth={2.5} dot={{r:4}} name={p.name.split(" ")[0]} connectNulls={false}/>
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}

                {poolTab==="prob" && (()=>{
                  const wp=calcWinProb(poolStandings,getPoolTeam,liveScores,sc);
                  return (
                  <div className="card">
                    <h3 className="h3" style={{marginBottom:4}}>Win Probability</h3>
                    <p className="sub" style={{marginBottom:18}}>Win % after each round based on actual team scores (softmax model)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={wp.data}>
                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                        <XAxis dataKey="r" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%" domain={[0,100]}/>
                        <Tooltip content={<CTooltip/>}/>
                        {wp.names.map((n,i)=>(
                          <Area key={n} type="monotone" dataKey={n} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i%6]} fill="none" strokeWidth={2} dot={{r:3}} name={n}/>
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}

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
                          const myParticipant = joinedParticipants.find(p=>String(p.id)===String(effectiveUserId)) || joinedParticipants[0];
                          const myTeam = getPoolTeam(myParticipant.id);
                          const myRank = poolStandings.findIndex(p=>p.id===myParticipant.id)+1;
                          const myScore = getPoolScore(myParticipant.id);
	                          const myTeamScores = myTeam
	                            .map(g=>{const ls=liveScores.find(l=>l.gId===g.id);return sumRounds(ls);})
	                            .filter(x=>typeof x==="number");
                          const myBirdies = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.birdies.reduce((a,b)=>a+b,0):0);},0);
                          const myEagles = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.eagles.reduce((a,b)=>a+b,0):0);},0);
                          const myBogeys = myTeam.reduce((t,g)=>{const ls=liveScores.find(l=>l.gId===g.id);return t+(ls?ls.bogeys.reduce((a,b)=>a+b,0):0);},0);
                          const bestGolferScore = myTeamScores.length?Math.min(...myTeamScores):null;
	                          const bestGolfer = myTeam.find(g=>{const ls=liveScores.find(l=>l.gId===g.id);return sumRounds(ls)===bestGolferScore;});
                          const allRounds = myTeam.flatMap(g=>{const ls=liveScores.find(l=>l.gId===g.id);return ls?[ls.R1,ls.R2,ls.R3,ls.R4].filter(v=>typeof v==='number'):[];});
                          const bestRound = allRounds.length?Math.min(...allRounds):null;
                          const sortedTeamScores = [...myTeamScores].sort((a,b)=>a-b);
	                          const countingScore = sortedTeamScores.length ? sortedTeamScores.slice(0,sc).reduce((a,b)=>a+b,0) : null;

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
                                  <p className="sub" style={{marginBottom:16}}>Total to-par score per golfer across played rounds</p>
                                  <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={myTeam.map(g=>{
                                      const s=liveScores.find(l=>l.gId===g.id);
                                      const tot=s?[s.R1,s.R2,s.R3,s.R4].filter(v=>v!==null&&v!==undefined).reduce((a,b)=>a+b,0):null;
                                      return {name:g.name.split(" ").pop(),score:tot??0,fill:tot===null?"#999":tot<0?"#40916C":tot===0?"#C8A94F":"#EF4444"};
                                    })} margin={{top:0,right:10,bottom:0,left:0}}>
                                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                      <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                                      <Tooltip content={<CTooltip/>} formatter={(v)=>[v>0?`+${v}`:v,"Score"]}/>
                                      <ReferenceLine y={0} stroke="var(--cream-2)" strokeDasharray="3 3"/>
                                      <Bar dataKey="score" name="To Par" radius={[3,3,0,0]}>
                                        {myTeam.map((g,i)=>{
                                          const s=liveScores.find(l=>l.gId===g.id);
                                          const tot=s?[s.R1,s.R2,s.R3,s.R4].filter(v=>v!==null&&v!==undefined).reduce((a,b)=>a+b,0):null;
                                          return <Cell key={g.id} fill={tot===null?"#999":tot<0?"#40916C":tot===0?"#C8A94F":"#EF4444"}/>;
                                        })}
                                      </Bar>
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
	                                    const tot=sumRounds(ls);
	                                    const sortedScores=[...myTeamScores].sort((a,b)=>a-b);
	                                    const isCounting=tot!==null&&sortedScores.indexOf(tot)<sc;
	                                    const tourneyPos=[...liveScores]
	                                      .map(s=>({...s,tot:sumRounds(s)}))
	                                      .sort((a,b)=>(a.tot??999999999)-(b.tot??999999999))
	                                      .findIndex(s=>s.gId===g.id)+1;
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

                              {/* Field Position Distribution */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Field Position Distribution</h3>
                                  <p className="sub" style={{marginBottom:16}}>How golfers in the field are distributed by position</p>
                                  <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={(() => {
                                      const buckets = {"Top 10":0,"11-25":0,"26-50":0,"51+":0,"CUT/WD":0};
                                      liveScores.forEach(s => {
                                        const p = s.pos;
                                        if (!p || p === "CUT" || p === "WD" || p === "DQ" || p === "MDF") buckets["CUT/WD"]++;
                                        else {
                                          const n = parseInt(String(p).replace("T",""),10);
                                          if (isNaN(n)) buckets["CUT/WD"]++;
                                          else if (n <= 10) buckets["Top 10"]++;
                                          else if (n <= 25) buckets["11-25"]++;
                                          else if (n <= 50) buckets["26-50"]++;
                                          else buckets["51+"]++;
                                        }
                                      });
                                      return Object.entries(buckets).map(([range,count]) => ({range,count}));
                                    })()} margin={{top:0,right:10,bottom:0,left:0}}>
                                      <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                      <XAxis dataKey="range" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                      <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} allowDecimals={false}/>
                                      <Tooltip content={<CTooltip/>}/>
                                      <Bar dataKey="count" name="Golfers" radius={[4,4,0,0]}>
                                        {["#1B4332","#40916C","#C8A94F","#78716C","#EF4444"].map((c,i) => <Cell key={i} fill={c}/>)}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Team vs Field Average */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Team vs Field Average</h3>
                                  <p className="sub" style={{marginBottom:16}}>How your team's scoring compares to the entire field</p>
                                  {(() => {
                                    const teamAvg = myTeamScores.length ? (myTeamScores.reduce((a,b) => a+b, 0) / myTeamScores.length) : null;
                                    const fieldScores = liveScores.map(s => sumRounds(s)).filter(x => typeof x === "number");
                                    const fieldAvg = fieldScores.length ? (fieldScores.reduce((a,b) => a+b, 0) / fieldScores.length) : null;
                                    const diff = (teamAvg !== null && fieldAvg !== null) ? teamAvg - fieldAvg : null;
                                    return (
                                      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center"}}>
                                        <div style={{textAlign:"center",padding:"20px 16px",background:"linear-gradient(135deg,var(--forest),var(--forest-mid))",borderRadius:12}}>
                                          <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(255,255,255,.6)",marginBottom:6}}>Your Team Avg</p>
                                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"var(--gold)",lineHeight:1}}>{teamAvg !== null ? fmtScore(Math.round(teamAvg * 10) / 10) : "—"}</div>
                                          <p style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:4}}>{myTeamScores.length} golfer{myTeamScores.length !== 1 ? "s" : ""} scoring</p>
                                        </div>
                                        <div style={{textAlign:"center"}}>
                                          <div style={{fontSize:13,fontWeight:700,color:diff !== null ? (diff < 0 ? "#40916C" : diff > 0 ? "#EF4444" : "var(--muted)") : "var(--muted)"}}>
                                            {diff !== null ? (diff < 0 ? "▲ " + Math.abs(Math.round(diff * 10) / 10) + " better" : diff > 0 ? "▼ " + (Math.round(diff * 10) / 10) + " worse" : "Even") : "—"}
                                          </div>
                                          <p style={{fontSize:10,color:"var(--muted)",marginTop:2}}>vs field</p>
                                        </div>
                                        <div style={{textAlign:"center",padding:"20px 16px",background:"var(--cream)",borderRadius:12}}>
                                          <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--muted)",marginBottom:6}}>Field Avg</p>
                                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"var(--forest)",lineHeight:1}}>{fieldAvg !== null ? fmtScore(Math.round(fieldAvg * 10) / 10) : "—"}</div>
                                          <p style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{fieldScores.length} golfer{fieldScores.length !== 1 ? "s" : ""} in field</p>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Round-by-Round Team Performance */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Round-by-Round Team Performance</h3>
                                  <p className="sub" style={{marginBottom:16}}>Your team's average score per round vs the field</p>
                                  {(() => {
                                    const rounds = ["R1","R2","R3","R4"];
                                    const data = rounds.map((rKey, ri) => {
                                      const teamRoundScores = myTeam.map(g => {
                                        const ls = liveScores.find(l => l.gId === g.id);
                                        return ls ? ls[rKey] : null;
                                      }).filter(v => typeof v === "number");
                                      const fieldRoundScores = liveScores.map(s => s[rKey]).filter(v => typeof v === "number");
                                      const teamAvg = teamRoundScores.length ? Math.round((teamRoundScores.reduce((a,b) => a+b, 0) / teamRoundScores.length) * 10) / 10 : null;
                                      const fieldAvg = fieldRoundScores.length ? Math.round((fieldRoundScores.reduce((a,b) => a+b, 0) / fieldRoundScores.length) * 10) / 10 : null;
                                      return {round: `Round ${ri+1}`, team: teamAvg, field: fieldAvg};
                                    }).filter(d => d.team !== null || d.field !== null);
                                    if (data.length < 1) return <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:20}}>No round data available yet</p>;
                                    return (
                                      <ResponsiveContainer width="100%" height={240}>
                                        <LineChart data={data} margin={{top:5,right:10,bottom:0,left:0}}>
                                          <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                                          <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                          <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `+${v}` : v === 0 ? "E" : String(v)}/>
                                          <Tooltip content={<CTooltip/>}/>
                                          <Line type="monotone" dataKey="team" stroke="#C8A94F" strokeWidth={3} dot={{r:5,fill:"#C8A94F"}} name="Your Team"/>
                                          <Line type="monotone" dataKey="field" stroke="#1B4332" strokeWidth={2} strokeDasharray="5 5" dot={{r:4,fill:"#1B4332"}} name="Field Avg"/>
                                          <Legend wrapperStyle={{fontSize:11}}/>
                                        </LineChart>
                                      </ResponsiveContainer>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Team Leaderboard Position Card */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Team Leaderboard Positions</h3>
                                  <p className="sub" style={{marginBottom:16}}>Position summary for your drafted golfers</p>
                                  {(() => {
                                    const teamPositions = myTeam.map(g => {
                                      const ls = liveScores.find(l => l.gId === g.id);
                                      const posStr = ls?.pos;
                                      const posNum = posStr ? parseInt(String(posStr).replace(/[^0-9]/g, ''), 10) : null;
                                      return { name: g.name, pos: isNaN(posNum) ? null : posNum };
                                    }).filter(p => p.pos !== null);
                                    if (!teamPositions.length) return <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:20}}>No position data available</p>;
                                    const best = teamPositions.reduce((a, b) => a.pos < b.pos ? a : b);
                                    const worst = teamPositions.reduce((a, b) => a.pos > b.pos ? a : b);
                                    const avgPos = Math.round(teamPositions.reduce((s, p) => s + p.pos, 0) / teamPositions.length);
                                    return (
                                      <div className="g3" style={{gap:12}}>
                                        {[
                                          { label: "Best Position", value: `#${best.pos}`, sub: best.name.split(" ").pop(), color: "#1B4332" },
                                          { label: "Worst Position", value: `#${worst.pos}`, sub: worst.name.split(" ").pop(), color: "#EF4444" },
                                          { label: "Avg Position", value: `#${avgPos}`, sub: `${teamPositions.length} golfer${teamPositions.length !== 1 ? "s" : ""}`, color: "#C8A94F" },
                                        ].map(item => (
                                          <div key={item.label} style={{textAlign:"center",padding:"18px 12px",background:"var(--cream)",borderRadius:12}}>
                                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:item.color,lineHeight:1}}>{item.value}</div>
                                            <div style={{fontSize:13,fontWeight:600,color:"var(--forest)",marginTop:6}}>{item.label}</div>
                                            <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{item.sub}</div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Cut Line Projection */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Cut Line Projection</h3>
                                  <p className="sub" style={{marginBottom:16}}>Which of your golfers are projected to make the cut</p>
                                  {(() => {
                                    const sortedField = liveScores
                                      .map(s => ({ gId: s.gId, tot: sumRounds(s) }))
                                      .filter(s => typeof s.tot === "number")
                                      .sort((a, b) => a.tot - b.tot);
                                    const cutPos = Math.floor(sortedField.length / 2);
                                    const cutScore = cutPos > 0 && sortedField.length > cutPos ? sortedField[cutPos - 1].tot : null;
                                    if (cutScore === null) return <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:20}}>Not enough data to project cut line</p>;
                                    const teamCutStatus = myTeam.map(g => {
                                      const ls = liveScores.find(l => l.gId === g.id);
                                      const tot = sumRounds(ls);
                                      const made = typeof tot === "number" ? tot <= cutScore : null;
                                      return { name: g.name, tot, made };
                                    });
                                    const madeCount = teamCutStatus.filter(g => g.made === true).length;
                                    const missedCount = teamCutStatus.filter(g => g.made === false).length;
                                    return (
                                      <div>
                                        <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                                          <div style={{padding:"10px 16px",background:"rgba(64,145,108,.1)",borderRadius:8,fontSize:13,fontWeight:600,color:"#40916C"}}>{madeCount} making cut</div>
                                          <div style={{padding:"10px 16px",background:"rgba(239,68,68,.1)",borderRadius:8,fontSize:13,fontWeight:600,color:"#EF4444"}}>{missedCount} missing cut</div>
                                          <div style={{padding:"10px 16px",background:"var(--cream)",borderRadius:8,fontSize:12,color:"var(--muted)"}}>Projected cut: {fmtScore(cutScore)}</div>
                                        </div>
                                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                          {teamCutStatus.map((g, i) => (
                                            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:g.made===true?"rgba(64,145,108,.05)":g.made===false?"rgba(239,68,68,.05)":"var(--cream)",borderRadius:8,border:`1px solid ${g.made===true?"rgba(64,145,108,.2)":g.made===false?"rgba(239,68,68,.2)":"var(--cream-2)"}`}}>
                                              <span style={{fontSize:18}}>{g.made===true?"✅":g.made===false?"❌":"➖"}</span>
                                              <span style={{flex:1,fontSize:13,fontWeight:600}}>{g.name}</span>
                                              <span style={{fontSize:13,color:g.made===true?"#40916C":g.made===false?"#EF4444":"var(--muted)",fontWeight:600}}>{typeof g.tot==="number"?fmtScore(g.tot):"—"}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Momentum Tracker */}
                              <div style={{marginTop:20}}>
                                <div className="card">
                                  <h3 className="h3" style={{marginBottom:4}}>Momentum Tracker</h3>
                                  <p className="sub" style={{marginBottom:16}}>Hottest and coldest golfers based on round-over-round scoring change</p>
                                  {(() => {
                                    const momentum = liveScores.map(s => {
                                      const g = findGolferById(s.gId);
                                      if (!g) return null;
                                      const rounds = [s.R1, s.R2, s.R3, s.R4].filter(v => typeof v === "number");
                                      if (rounds.length < 2) return null;
                                      const diff = rounds[rounds.length - 1] - rounds[rounds.length - 2];
                                      return { name: g.name.split(" ").pop(), diff, gId: s.gId };
                                    }).filter(Boolean);
                                    if (momentum.length < 2) return <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:20}}>Need at least 2 rounds of data</p>;
                                    const sorted = [...momentum].sort((a, b) => a.diff - b.diff);
                                    const hottest = sorted.slice(0, 5);
                                    const coldest = sorted.slice(-5).reverse();
                                    const combined = [
                                      ...hottest.map(m => ({ ...m, type: "hot" })),
                                      ...coldest.filter(c => !hottest.find(h => h.gId === c.gId)).map(m => ({ ...m, type: "cold" })),
                                    ];
                                    const maxAbs = Math.max(...combined.map(m => Math.abs(m.diff)), 1);
                                    return (
                                      <div>
                                        <div style={{display:"flex",gap:12,marginBottom:14}}>
                                          <span style={{fontSize:11,fontWeight:600,color:"#40916C"}}>🔥 Trending Up</span>
                                          <span style={{fontSize:11,fontWeight:600,color:"#EF4444"}}>🧊 Trending Down</span>
                                        </div>
                                        <ResponsiveContainer width="100%" height={Math.max(combined.length * 36, 120)}>
                                          <BarChart data={combined} layout="vertical" margin={{top:0,right:20,bottom:0,left:60}}>
                                            <CartesianGrid stroke="var(--cream-2)" horizontal={false}/>
                                            <XAxis type="number" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `+${v}` : String(v)} domain={[-maxAbs, maxAbs]}/>
                                            <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} width={55}/>
                                            <Tooltip formatter={(v) => [v > 0 ? `+${v}` : String(v), "Momentum"]}/>
                                            <ReferenceLine x={0} stroke="var(--parchment)" strokeWidth={1.5}/>
                                            <Bar dataKey="diff" name="Change" maxBarSize={20}>
                                              {combined.map((m, i) => (
                                                <Cell key={i} fill={m.diff <= 0 ? "#40916C" : "#EF4444"} radius={m.diff <= 0 ? [4,0,0,4] : [0,4,4,0]}/>
                                              ))}
                                            </Bar>
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Score Distribution Histogram */}
                              {(()=>{
                                const allTots=liveScores.map(s=>sumRounds(s)).filter(v=>v!==null);
                                if(allTots.length<4) return null;
                                const mn=Math.min(...allTots), mx=Math.max(...allTots);
                                const bucketSize=Math.max(1,Math.ceil((mx-mn)/8));
                                const buckets=[];
                                for(let b=mn;b<=mx;b+=bucketSize){
                                  const lo=b, hi=b+bucketSize;
                                  const cnt=allTots.filter(v=>v>=lo&&v<hi).length;
                                  const label=lo>=0?`+${lo}`:`${lo}`;
                                  const hasTeam=myTeam.some(g=>{const s=liveScores.find(l=>l.gId===g.id);const t=sumRounds(s);return t!==null&&t>=lo&&t<hi;});
                                  buckets.push({range:label,count:cnt,hasTeam});
                                }
                                return (
                                  <div className="card" style={{marginTop:0}}>
                                    <h3 className="h3" style={{marginBottom:4}}>Score Distribution</h3>
                                    <p className="sub" style={{marginBottom:16}}>How scores are spread across the entire field</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                      <BarChart data={buckets} margin={{top:0,right:10,bottom:0,left:0}}>
                                        <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                        <XAxis dataKey="range" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                        <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} allowDecimals={false}/>
                                        <Tooltip formatter={(v)=>[v,"Golfers"]}/>
                                        <Bar dataKey="count" name="Golfers" radius={[3,3,0,0]}>
                                          {buckets.map((b,i)=><Cell key={i} fill={b.hasTeam?"var(--gold)":"#2D6A4F"}/>)}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                    <p style={{fontSize:10,color:"var(--muted)",marginTop:8,textAlign:"center"}}>Gold bars contain your team's golfers</p>
                                  </div>
                                );
                              })()}

                              {/* Top 10 Leaderboard Mini */}
                              {(()=>{
                                const sorted=[...liveScores].map(s=>{const g=findGolferById(s.gId);return g?{name:g.name.split(" ").pop(),tot:sumRounds(s),isTeam:myTeam.some(t=>t.id===s.gId)}:null;}).filter(s=>s&&s.tot!==null).sort((a,b)=>a.tot-b.tot).slice(0,10);
                                if(sorted.length<3) return null;
                                return (
                                  <div className="card" style={{marginTop:0}}>
                                    <h3 className="h3" style={{marginBottom:4}}>Top 10 Leaderboard</h3>
                                    <p className="sub" style={{marginBottom:16}}>Current tournament leaders</p>
                                    <ResponsiveContainer width="100%" height={Math.max(sorted.length*32,120)}>
                                      <BarChart data={sorted} layout="vertical" margin={{top:0,right:20,bottom:0,left:60}}>
                                        <CartesianGrid stroke="var(--cream-2)" horizontal={false}/>
                                        <XAxis type="number" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:String(v)}/>
                                        <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} width={55}/>
                                        <Tooltip formatter={(v)=>[v>0?`+${v}`:String(v),"Score"]}/>
                                        <ReferenceLine x={0} stroke="var(--parchment)" strokeWidth={1.5}/>
                                        <Bar dataKey="tot" name="Score" maxBarSize={18}>
                                          {sorted.map((s,i)=><Cell key={i} fill={s.isTeam?"var(--gold)":"#2D6A4F"}/>)}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                    <p style={{fontSize:10,color:"var(--muted)",marginTop:8,textAlign:"center"}}>Gold = your team's golfers</p>
                                  </div>
                                );
                              })()}

                              {/* Team Consistency Meter */}
                              {(()=>{
                                const teamRoundData=myTeam.map(g=>{
                                  const ls=liveScores.find(l=>l.gId===g.id);
                                  if(!ls) return null;
                                  const rds=[ls.R1,ls.R2,ls.R3,ls.R4].filter(v=>typeof v==="number");
                                  if(rds.length<2) return null;
                                  const avg=rds.reduce((a,b)=>a+b,0)/rds.length;
                                  const variance=rds.reduce((s,v)=>s+Math.pow(v-avg,2),0)/rds.length;
                                  const stdDev=Math.sqrt(variance);
                                  return {name:g.name.split(" ").pop(),avg:Math.round(avg*10)/10,stdDev:Math.round(stdDev*10)/10,best:Math.min(...rds),worst:Math.max(...rds)};
                                }).filter(Boolean);
                                if(teamRoundData.length<1) return null;
                                return (
                                  <div className="card" style={{marginTop:0}}>
                                    <h3 className="h3" style={{marginBottom:4}}>Team Consistency</h3>
                                    <p className="sub" style={{marginBottom:16}}>Lower spread = more consistent scoring</p>
                                    <ResponsiveContainer width="100%" height={220}>
                                      <BarChart data={teamRoundData} margin={{top:10,right:10,bottom:0,left:0}}>
                                        <CartesianGrid stroke="var(--cream-2)" vertical={false}/>
                                        <XAxis dataKey="name" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                        <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                        <Tooltip content={<CTooltip/>}/>
                                        <Bar dataKey="best" name="Best Round" fill="#40916C" radius={[3,3,0,0]}/>
                                        <Bar dataKey="worst" name="Worst Round" fill="#EF4444" radius={[3,3,0,0]}/>
                                        <Bar dataKey="avg" name="Average" fill="var(--gold)" radius={[3,3,0,0]}/>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                );
                              })()}

                              {/* Cumulative Team Score Area Chart */}
                              {(()=>{
                                const roundLabels=["R1","R2","R3","R4"];
                                const areaData=[];
                                let cumTeam=0, cumField=0;
                                for(let ri=0;ri<roundLabels.length;ri++){
                                  const r=roundLabels[ri];
                                  let teamSum=0, fieldSum=0, fieldCount=0;
                                  myTeam.forEach(g=>{
                                    const ls=liveScores.find(l=>l.gId===g.id);
                                    if(ls&&ls[r]!==null&&ls[r]!==undefined) teamSum+=ls[r];
                                  });
                                  liveScores.forEach(s=>{
                                    if(s[r]!==null&&s[r]!==undefined){fieldSum+=s[r];fieldCount++;}
                                  });
                                  const fieldAvg=fieldCount?Math.round((fieldSum/fieldCount)*10)/10:0;
                                  cumTeam+=teamSum; cumField+=fieldAvg;
                                  areaData.push({round:r,team:cumTeam,field:cumField});
                                }
                                if(!areaData.some(d=>d.team!==0)) return null;
                                return (
                                  <div className="card" style={{marginTop:0}}>
                                    <h3 className="h3" style={{marginBottom:4}}>Cumulative Score Trend</h3>
                                    <p className="sub" style={{marginBottom:16}}>Your team's total vs field average over rounds</p>
                                    <ResponsiveContainer width="100%" height={220}>
                                      <AreaChart data={areaData} margin={{top:10,right:10,bottom:0,left:0}}>
                                        <defs>
                                          <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1B4332" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#1B4332" stopOpacity={0}/>
                                          </linearGradient>
                                          <linearGradient id="fieldGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#C8A94F" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#C8A94F" stopOpacity={0}/>
                                          </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                                        <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                                        <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:String(v)}/>
                                        <Tooltip content={<CTooltip/>}/>
                                        <Area type="monotone" dataKey="team" name="Your Team" stroke="#1B4332" fill="url(#teamGrad)" strokeWidth={2.5}/>
                                        <Area type="monotone" dataKey="field" name="Field Avg" stroke="#C8A94F" fill="url(#fieldGrad)" strokeWidth={2} strokeDasharray="5 5"/>
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  </div>
                                );
                              })()}
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
	                          const ta=(sumRounds(lsa) ?? 999999999);
	                          const tb=(sumRounds(lsb) ?? 999999999);
	                          return ta-tb;
	                        }).map((g,idx)=>{
	                          const ls=liveScores.find(l=>l.gId===g.id);
	                          const tot=sumRounds(ls);
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
	                              {ls
	                                ? [ls.R1,ls.R2,ls.R3,ls.R4].map((v,i)=><div key={i} style={{textAlign:"right"}}>{fmtScore(v)}</div>)
	                                : [null,null,null,null].map((_,i)=><div key={i} style={{textAlign:"right",color:"var(--muted)"}}></div>)
	                              }
	                              <div style={{textAlign:"right",fontSize:15}}>{fmtScore(tot)}</div>
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
	                          const tot = sumRounds(ls);
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
                          const totA=lsA?[lsA.R1,lsA.R2,lsA.R3,lsA.R4].filter(v=>typeof v==='number').reduce((a,b)=>a+b,0):null;
                          const totB=lsB?[lsB.R1,lsB.R2,lsB.R3,lsB.R4].filter(v=>typeof v==='number').reduce((a,b)=>a+b,0):null;
                          const rounds=["R1","R2","R3","R4"].map((r,ri)=>({
                            round:r,
                            [compareA.name.split(" ").pop()]:lsA?lsA[r]:0,
                            [compareB.name.split(" ").pop()]:lsB?lsB[r]:0,
                          }));
                          const sgA=SG_DATA[compareA.id], sgB=SG_DATA[compareB.id];
                          const statRows=[
                            {l:"Total Score",a:totA!==null?fmtScore(totA):"—",b:totB!==null?fmtScore(totB):"—",win:totA!==null&&totB!==null?(totA<totB?"a":totA>totB?"b":"e"):null},
                            {l:"World Rank",a:`#${compareA.rank}`,b:`#${compareB.rank}`,win:compareA.rank<compareB.rank?"a":compareA.rank>compareB.rank?"b":"e"},
                            ...(compareA.avg||compareB.avg?[{l:"Scoring Avg",a:compareA.avg||"—",b:compareB.avg||"—",win:compareA.avg&&compareB.avg?(compareA.avg<compareB.avg?"a":compareA.avg>compareB.avg?"b":"e"):null}]:[]),
                            ...(compareA.drivDist||compareB.drivDist?[{l:"Drive Dist",a:compareA.drivDist?`${compareA.drivDist} yds`:"—",b:compareB.drivDist?`${compareB.drivDist} yds`:"—",win:compareA.drivDist&&compareB.drivDist?(compareA.drivDist>compareB.drivDist?"a":compareA.drivDist<compareB.drivDist?"b":"e"):null}]:[]),
                            ...(compareA.gir||compareB.gir?[{l:"GIR %",a:compareA.gir?`${compareA.gir}%`:"—",b:compareB.gir?`${compareB.gir}%`:"—",win:compareA.gir&&compareB.gir?(compareA.gir>compareB.gir?"a":compareA.gir<compareB.gir?"b":"e"):null}]:[]),
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
                              <div className="card" style={{marginBottom:16}}>
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

                              {/* Round-by-Round Comparison Table */}
                              <div className="card" style={{padding:0,overflow:"hidden"}}>
                                <h3 className="h3" style={{padding:"16px 16px 4px"}}>Round-by-Round Scorecard</h3>
                                <p className="sub" style={{padding:"0 16px 12px"}}>Side-by-side round scores with winner highlighted</p>
                                <div style={{display:"grid",gridTemplateColumns:"70px 1fr 60px 1fr",background:"var(--forest)",padding:"8px 16px"}}>
                                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Round</span>
                                  <span style={{fontSize:12,fontWeight:700,color:"#fff",textAlign:"center"}}>{compareA.name.split(" ").pop()}</span>
                                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)",textAlign:"center"}}>vs</span>
                                  <span style={{fontSize:12,fontWeight:700,color:"var(--gold)",textAlign:"center"}}>{compareB.name.split(" ").pop()}</span>
                                </div>
                                {["R1","R2","R3","R4"].map((rKey, ri) => {
                                  const aVal = lsA ? lsA[rKey] : null;
                                  const bVal = lsB ? lsB[rKey] : null;
                                  const aNum = typeof aVal === "number" ? aVal : null;
                                  const bNum = typeof bVal === "number" ? bVal : null;
                                  const winner = (aNum !== null && bNum !== null) ? (aNum < bNum ? "a" : aNum > bNum ? "b" : "e") : null;
                                  return (
                                    <div key={rKey} style={{display:"grid",gridTemplateColumns:"70px 1fr 60px 1fr",padding:"10px 16px",borderBottom:"1px solid var(--cream-2)",background:ri%2===0?"#fff":"var(--cream)",alignItems:"center"}}>
                                      <span style={{fontSize:12,fontWeight:600,color:"var(--muted)"}}>Round {ri+1}</span>
                                      <div style={{textAlign:"center",padding:"6px 8px",borderRadius:6,background:winner==="a"?"rgba(27,67,50,.1)":"transparent"}}>
                                        <span style={{fontSize:15,fontWeight:winner==="a"?700:400,color:winner==="a"?"#1B4332":"var(--text)"}}>{aNum!==null?fmtScore(aNum):"—"}</span>
                                        {winner==="a"&&<span style={{marginLeft:6,fontSize:10,color:"#40916C"}}>W</span>}
                                      </div>
                                      <div style={{textAlign:"center",fontSize:11,color:"var(--muted)"}}>{(aNum!==null&&bNum!==null)?((aNum-bNum)<0?aNum-bNum:`+${aNum-bNum===0?"0":aNum-bNum}`):"—"}</div>
                                      <div style={{textAlign:"center",padding:"6px 8px",borderRadius:6,background:winner==="b"?"rgba(200,169,79,.1)":"transparent"}}>
                                        <span style={{fontSize:15,fontWeight:winner==="b"?700:400,color:winner==="b"?"#C8A94F":"var(--text)"}}>{bNum!==null?fmtScore(bNum):"—"}</span>
                                        {winner==="b"&&<span style={{marginLeft:6,fontSize:10,color:"#C8A94F"}}>W</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(() => {
                                  const aWins = ["R1","R2","R3","R4"].filter(r => {const a=lsA?lsA[r]:null,b=lsB?lsB[r]:null;return typeof a==="number"&&typeof b==="number"&&a<b;}).length;
                                  const bWins = ["R1","R2","R3","R4"].filter(r => {const a=lsA?lsA[r]:null,b=lsB?lsB[r]:null;return typeof a==="number"&&typeof b==="number"&&b<a;}).length;
                                  return (
                                    <div style={{display:"grid",gridTemplateColumns:"70px 1fr 60px 1fr",padding:"12px 16px",background:"var(--forest)"}}>
                                      <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.6)"}}>Rounds Won</span>
                                      <span style={{fontSize:15,fontWeight:700,color:"#fff",textAlign:"center"}}>{aWins}</span>
                                      <span style={{fontSize:11,color:"rgba(255,255,255,.4)",textAlign:"center"}}>—</span>
                                      <span style={{fontSize:15,fontWeight:700,color:"var(--gold)",textAlign:"center"}}>{bWins}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })() : (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"var(--muted)"}}>
                            <p style={{fontSize:32,marginBottom:8}}>⚖️</p>
                            <p style={{fontSize:14,fontWeight:600}}>Select two players above to compare</p>
                            <p style={{fontSize:12,marginTop:4}}>No live tournament field loaded yet (seed golfers/API data).</p>
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
              <button className="btn btn-ghost btn-sm" onClick={()=>setView("home")}>← Home</button>
              <div>
                <h2 className="h2">Create New Pool</h2>
                <p className="sub">Configure your pool here. Invite links are available after the pool is created.</p>
              </div>
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
                        <p style={{fontSize:12,color:"var(--muted)"}}>{t.venue} · {t.date} · {t.purse} purse · <strong>{getTournamentFieldSize(t.id)} players</strong></p>
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
                      {[2,3,4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n} participants</option>)}
                    </select>
                  </div>
                  <div className="fgrp">
                    <label className="label">Golfers Per Team</label>
                    <select className="inp" value={config.teamSize} onChange={e=>setConfig(c=>({...c,teamSize:+e.target.value,scoringGolfers:Math.min(config.scoringGolfers,+e.target.value)}))}>
                      {[4,5,6,7,8,9,10,11,12].map(n=><option key={n} value={n}>{n} golfers per team</option>)}
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
                  <button className="btn btn-prim" style={{width:"100%",justifyContent:"center"}} disabled={createBusy} onClick={async ()=>{
                    if (createBusy) return;
                    if (!config.tournament) {
                      notify("Select a tournament first.", "error");
                      return;
                    }
                    if (!apiToken.get()) {
                      notify("Session expired. Please log in again before creating a shared pool.", "error");
                      setView("invite");
                      setInviteView(true);
                      setAuthMode("login");
                      return;
                    }
                    try {
                      await Auth.me();
                    } catch {
                      notify("Session expired. Please log in again before creating a shared pool.", "error");
                      setView("invite");
                      setInviteView(true);
                      setAuthMode("login");
                      return;
                    }
                    // Prefer backend pool creation for multi-user shared lobbies.
                    setCreateBusy(true);
                    try {
                      const resp = await Pools.create({
                        name: config.poolName,
                        tournament_id: config.tournament,
                        max_participants: config.maxParticipants,
                        team_size: config.teamSize,
                        scoring_golfers: config.scoringGolfers,
                        cut_line: config.cutLine,
                        shot_clock: config.shotClock,
                      });
                      const bp = resp?.pool || {};
                      const newPool = {
                        id: bp.id,
                        name: bp.name || config.poolName,
                        tournamentId: bp.tournament_id || config.tournament,
                        status: bp.status || "lobby",
                        participants: 1,
                        maxParticipants: Number(bp.max_participants || config.maxParticipants),
                        teamSize: Number(bp.team_size || config.teamSize),
                        scoringGolfers: Number(bp.scoring_golfers || config.scoringGolfers),
                        cutLine: Number(bp.cut_line || config.cutLine),
                        shotClock: Number(bp.shot_clock || config.shotClock),
                        draftOrderType: config.draftOrderType,
                        invite_token: bp.invite_token || pendingInviteToken,
                        yourRank: null,
                        yourScore: null,
                        hostId: bp.host_id || getEffectiveUserId(),
                        created: bp.created_at ? new Date(bp.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
                      };
                      setPools((p)=>[...p.filter(x=>x.id!==newPool.id), newPool]);
                      const creatorId = getEffectiveUserId();
                      if (creatorId) {
                        setPoolMembers((m)=>({ ...m, [newPool.id]: [creatorId] }));
                        ensureParticipant({
                          id: creatorId,
                          name: getEffectiveUserName(),
                          email: getEffectiveUserEmail(),
                          avatar: getEffectiveUserAvatar(),
                        });
                      }
                      setActivePool(newPool);
                      setPoolPhase("lobby");
                      setPoolReadyMap({});
                      setConfirmDelete(false);
                      setView("pool");
                      setPendingInviteToken(makeInviteToken());
                      notify("Pool created! Share the invite link to get people in.");
                    } catch (e) {
                      notify(e?.message || "Could not create pool. Please try again.", "error");
                    } finally {
                      setCreateBusy(false);
                    }
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
                    <span className="link-txt" title={activePool ? buildInviteUrl(activePool) : createFlowInviteUrl}>
                      {activePool ? compactInviteUrl(activePool) : `${SITE_BASE}/join/${pendingInviteToken.slice(0,7)}…${pendingInviteToken.slice(-5)}`}
                    </span>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>copyLink(activePool ? buildInviteUrl(activePool) : createFlowInviteUrl)}>📋 Copy</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {["📧 Email invite","💬 Copy for text","🐦 Share link"].map(l=>(
                      <button key={l} className="btn btn-ghost btn-sm" onClick={()=>copyLink(activePool ? buildInviteUrl(activePool) : createFlowInviteUrl)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3 className="h3" style={{marginBottom:6}}>How It Works</h3>
                  <p className="sub" style={{marginBottom:14,fontSize:13}}>When someone clicks your invite link, they'll see a page where they can:</p>
                  {[
                    ["🔐","Log in to an existing account","Returning players log in, then tap Join Pool"],
                    ["✨","Create a new account","New players sign up, then tap Join Pool"],
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
                <div className="logo" style={{fontSize:22,display:"inline-block",marginBottom:12}}><em style={{color:"var(--text)"}}>Golf</em><span style={{color:"var(--gold)"}}>PoolPro</span></div>
                {invitePool && (
                  <div style={{background:"var(--forest)",borderRadius:12,padding:"16px 20px",color:"#fff",marginBottom:0}}>
                    <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"rgba(255,255,255,.55)",marginBottom:4}}>You've been invited to</p>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>{invitePool.name}</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>
                      {invitePool.tournamentName || tournaments.find(t=>t.id===invitePool.tournamentId)?.name || "Tournament TBD"}
                    </p>
                  </div>
                )}
                {!invitePool && (
                  <p style={{fontSize:14,color:"var(--muted)"}}>Sign in or create an account to join golf pools</p>
                )}
              </div>

              {invitePool && (
                <div style={{marginTop:-10,marginBottom:18}}>
                  <button
                    type="button"
                    className="btn btn-prim"
                    style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px"}}
                    onClick={handleInviteJoinCTA}
                    disabled={authBusy}
                  >
                    {apiToken.get() ? (authBusy ? "Joining..." : "Join Pool") : "Join Pool"}
                  </button>
                  <p style={{marginTop:10,fontSize:12,color:"var(--muted)",textAlign:"center"}}>
                    {apiToken.get()
                      ? "You’ll be taken straight into the lobby."
                      : "Log in or create an account, then you’ll be taken straight into the lobby."}
                  </p>
                </div>
              )}

              {invitePool && (
                <div style={{background:"var(--cream)",border:"1px solid var(--cream-2)",borderRadius:12,padding:"14px 16px",marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>POOL</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{invitePool.name}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>TOURNAMENT</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)",textAlign:"right"}}>
                      {invitePool.tournamentName || tournaments.find(t=>t.id===invitePool.tournamentId)?.name || "TBD"}
                    </span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>SPOTS</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>
                      {Number(invitePool.participants || 0)}/{Number(invitePool.maxParticipants || 8)}
                    </span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>TEAM SIZE</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{invitePool.teamSize || 4} golfers</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>SCORING</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Best {invitePool.scoringGolfers || 2}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--cream-2)"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>CUT RULE</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Min {invitePool.cutLine || 2} make cut</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".3px"}}>SHOT CLOCK</span>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{invitePool.shotClock || 60}s</span>
                  </div>
                </div>
              )}

              {(authMode==="login" || authMode==="signup") && (
                <div className="auth-tabs">
                  <button type="button" className={`auth-tab ${authMode==="login"?"on":""}`} onClick={()=>{setAuthMode("login");setAuthError("");setAuthSuccess("");}}>Log In</button>
                  <button type="button" className={`auth-tab ${authMode==="signup"?"on":""}`} onClick={()=>{setAuthMode("signup");setAuthError("");setAuthSuccess("");}}>Create Account</button>
                </div>
              )}

              {authMode==="login" && (
                <div>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input ref={loginEmailRef} className="inp" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{nextRef:loginPassRef})}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Password</label>
                    <input ref={loginPassRef} className="inp" type="password" name="password" autoComplete="current-password" placeholder="Your password" value={authPass} onChange={e=>{setAuthPass(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{submit:handleLogin})}/>
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  <button type="button" className="btn btn-gold" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:14}} onClick={handleLogin} disabled={authBusy}>
                    {authBusy ? "Logging In..." : "Log In"}
                  </button>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <button type="button" className="btn-link" style={{fontSize:13}} onClick={()=>{setAuthMode("forgot");setAuthError("");setForgotSent(false);}}>
                      Forgot your password?
                    </button>
                    {currentUser && (
                      <button type="button" className="btn-link" style={{fontSize:13}} onClick={()=>{setView("home");setActivePool(null);}}>
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
                    <input ref={signupNameRef} className="inp" name="name" autoComplete="name" placeholder="Your full name" value={authName} onChange={e=>{setAuthName(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{nextRef:signupEmailRef})}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input ref={signupEmailRef} className="inp" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{nextRef:signupPassRef})}/>
                  </div>
                  <div className="fgrp">
                    <label className="label">Create Password</label>
                    <input ref={signupPassRef} className="inp" type="password" name="new-password" autoComplete="new-password" placeholder="Min. 6 characters" value={authPass} onChange={e=>{setAuthPass(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{submit:handleSignup})}/>
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  <button type="button" className="btn btn-gold" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:12}} onClick={handleSignup} disabled={authBusy}>
                    {authBusy ? "Creating Account..." : "Create Account"}
                  </button>
                  <p style={{fontSize:11,color:"var(--muted)",textAlign:"center",lineHeight:1.5}}>
                    By creating an account you agree to our Terms of Service and Privacy Policy.
                  </p>
                  {currentUser && (
                    <div style={{marginTop:14,textAlign:"center"}}>
                      <button type="button" className="btn-link" onClick={()=>{setView("home");setActivePool(null);}}>Back to Home</button>
                    </div>
                  )}
                </div>
              )}

              {authMode==="forgot" && (
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setAuthMode("login")}>← Back to Login</button>
                  <h3 className="h3" style={{marginBottom:6}}>Reset Your Password</h3>
                  <p className="sub" style={{marginBottom:20,fontSize:13}}>Enter your email address and we'll send you a link to reset your password.</p>
                  <div className="fgrp">
                    <label className="label">Email Address</label>
                    <input ref={forgotEmailRef} className="inp" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={authEmail} onChange={e=>{setAuthEmail(e.target.value);setAuthError("");}} onKeyDown={(e)=>handleAuthEnter(e,{submit:handleForgotPassword})}/>
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
                    <button type="button" className="btn btn-prim" style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:12}} onClick={handleForgotPassword} disabled={authBusy}>
                      {authBusy ? "Sending..." : "Send Reset Link"}
                    </button>
                  )}
                  <div style={{textAlign:"center"}}>
                    <button type="button" className="btn-link" onClick={()=>setAuthMode("login")}>Return to login</button>
                  </div>
                </div>
              )}

              {authMode==="reset" && (
                <div>
                  <h3 className="h3" style={{marginBottom:6}}>Set a New Password</h3>
                  <p className="sub" style={{marginBottom:20,fontSize:13}}>Enter your new password to finish resetting your account.</p>
                  <div className="fgrp">
                    <label className="label">New Password</label>
                    <input
                      ref={resetPassRef}
                      className="inp"
                      type="password"
                      name="new-password"
                      autoComplete="new-password"
                      placeholder="Min. 6 characters"
                      value={resetPass}
                      onChange={(e)=>{setResetPass(e.target.value);setAuthError("");}}
                      onKeyDown={(e)=>handleAuthEnter(e,{nextRef:resetPassConfirmRef})}
                    />
                  </div>
                  <div className="fgrp">
                    <label className="label">Confirm Password</label>
                    <input
                      ref={resetPassConfirmRef}
                      className="inp"
                      type="password"
                      name="confirm-password"
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={resetPassConfirm}
                      onChange={(e)=>{setResetPassConfirm(e.target.value);setAuthError("");}}
                      onKeyDown={(e)=>handleAuthEnter(e,{submit:handleResetPasswordFromLink})}
                    />
                  </div>
                  {authError && <p style={{color:"var(--red)",fontSize:13,marginBottom:12,fontWeight:600}}>{authError}</p>}
                  {authSuccess && <p style={{color:"var(--green)",fontSize:13,marginBottom:12,fontWeight:700}}>{authSuccess}</p>}
                  <button
                    type="button"
                    className="btn btn-prim"
                    style={{width:"100%",justifyContent:"center",fontSize:15,padding:"13px",marginBottom:12}}
                    onClick={handleResetPasswordFromLink}
                    disabled={authBusy}
                  >
                    {authBusy ? "Updating..." : "Update Password"}
                  </button>
                  <div style={{textAlign:"center"}}>
                    <button type="button" className="btn-link" onClick={()=>{setAuthMode("login");setAuthError("");}}>Return to login</button>
                  </div>
                </div>
              )}

              {/* Note: There is intentionally only ONE Join Pool button on this page (above).
                  Logged-out users authenticate, then we auto-join and route into the lobby. */}

              {authMode!=="forgot" && authMode!=="join" && authSuccess && (
                <p style={{color:"var(--green)",fontSize:13,marginTop:14,fontWeight:700,textAlign:"center"}}>{authSuccess}</p>
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

            {analyticsTab==="chart" && (()=>{
              const roundKeys=["R1","R2","R3","R4"];
              const playedRnds=roundKeys.filter(rk=>liveScores.some(s=>typeof s[rk]==="number"));
              if(playedRnds.length===0) return <div className="card"><p style={{color:"var(--muted)",textAlign:"center",padding:40}}>No round data yet</p></div>;
              // Use top 6 players by score
              const top6=[...liveScores].map(s=>({...s,tot:sumRounds(s)})).filter(s=>s.tot!==null).sort((a,b)=>a.tot-b.tot).slice(0,6);
              const top6Names=top6.map(s=>{const g=findGolferById(s.gId);return g?g.name.split(" ").pop():"?";});
              const chartData=playedRnds.map((r,ri)=>({
                round:r,
                ...top6.reduce((acc,s,si)=>{
                  acc[top6Names[si]]=playedRnds.slice(0,ri+1).map(rk=>s[rk]).filter(v=>typeof v==="number").reduce((a,b)=>a+b,0);
                  return acc;
                },{})
              }));
              return (
              <div className="card">
                <h3 className="h3" style={{marginBottom:4}}>Cumulative Score — All Rounds</h3>
                <p className="sub" style={{marginBottom:18}}>Round-by-round total score progression (lower = better)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart margin={{top:5,right:10,bottom:0,left:0}} data={chartData}>
                    <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                    <XAxis dataKey="round" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} tickFormatter={v=>v>0?`+${v}`:v}/>
                    <Tooltip content={<CTooltip/>}/>
                    {top6Names.map((n,i)=>(
                      <Line key={n} type="monotone" dataKey={n} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i]} strokeWidth={2.5} dot={{r:4}} name={n}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              );
            })()}

            {analyticsTab==="teams" && (
              <div className="g2">
	                {standings.map((p,i)=>{
	                  const scores=p.team
	                    .map(g=>{const ls=liveScores.find(l=>l.gId===g.id);return sumRounds(ls);})
	                    .filter(v=>typeof v==="number")
	                    .sort((a,b)=>a-b);
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
	                        const tot=sumRounds(ls);
	                        const isCounting=tot!==null&&scores.indexOf(tot)<2;
	                        return (
                          <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--cream-2)",opacity:isCounting?1:0.5}}>
                            {isCounting&&<span style={{fontSize:10,background:"var(--gold-pale)",color:"#7A5C00",padding:"1px 5px",borderRadius:3,fontWeight:700,flexShrink:0}}>★</span>}
	                            {!isCounting&&<span style={{width:19,flexShrink:0}}/>}
	                            <p style={{fontSize:13,flex:1,fontWeight:isCounting?600:400}}>{g.country} {g.name}</p>
	                            {fmtScore(tot)}
	                          </div>
	                        );
	                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {analyticsTab==="prob" && (()=>{
              const wp=calcWinProb(standings,getTeam,liveScores,scoringGolfers);
              return (
              <div className="card">
                <h3 className="h3" style={{marginBottom:4}}>Win Probability Tracker</h3>
                <p className="sub" style={{marginBottom:18}}>Win % after each round based on actual team scores (softmax model)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={wp.data}>
                    <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                    <XAxis dataKey="r" tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:11,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%" domain={[0,100]}/>
                    <Tooltip content={<CTooltip/>}/>
                    {wp.names.map((n,i)=>(
                      <Area key={n} type="monotone" dataKey={n} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0","#C0A0B0","#90A875"][i%8]} fill="none" strokeWidth={2} dot={{r:3}} name={n}/>
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              );
            })()}
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
                  {(()=>{
                    const wp=calcWinProb(standings,getTeam,liveScores,scoringGolfers);
                    return (<>
                  <h4 className="h4" style={{marginTop:16,marginBottom:10}}>Win Probability</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={wp.data}>
                      <CartesianGrid stroke="var(--cream-2)" strokeDasharray="3 3"/>
                      <XAxis dataKey="r" tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:"#78716C"}} axisLine={false} tickLine={false} unit="%" domain={[0,100]}/>
                      <Tooltip content={<CTooltip/>}/>
                      {wp.names.map((n,i)=>(
                        <Area key={n} type="monotone" dataKey={n} stroke={["#1B4332","#C8A94F","#40916C","#7E9B84","#B08968","#6B9BC0"][i%6]} fill="none" strokeWidth={2}/>
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                    </>);
                  })()}
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
	                  const tot=sumRounds(ls);
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
