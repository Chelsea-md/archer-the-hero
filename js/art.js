// ============================================================
// art.js — Procedural illustrations for skill cards (no image
// assets: everything is drawn in canvas, matching the game's
// flat rounded style). Canvas is expected to be ~128×84.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  RA.drawSkillArt = function (ctx, id, w, h) {
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const glow = (color) => {
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.66);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    const circle = (x, y, r, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    };

    switch (id) {
      case 'mothersEgg': {
        glow('rgba(255, 226, 170, 0.4)');
        ctx.fillStyle = '#f5eddc';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, 19, 25, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#e0d0a8';
        circle(cx - 7, cy - 2, 2.2, '#e0d0a8');
        circle(cx + 6, cy + 10, 2.6, '#e0d0a8');
        circle(cx + 2, cy - 10, 1.8, '#e0d0a8');
        // little heart floating beside it
        ctx.fillStyle = '#e8697a';
        ctx.save();
        ctx.translate(cx + 24, cy - 18);
        ctx.beginPath();
        ctx.arc(-3, 0, 4, 0, 7); ctx.arc(3, 0, 4, 0, 7);
        ctx.moveTo(-6.5, 2); ctx.lineTo(0, 10); ctx.lineTo(6.5, 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'uniform': {
        // Robin Hood green, feathered-cap energy
        glow('rgba(74, 158, 82, 0.4)');
        ctx.fillStyle = '#4a9e52';
        ctx.beginPath();
        ctx.moveTo(cx - 17, cy - 16);
        ctx.lineTo(cx - 32, cy - 4); ctx.lineTo(cx - 24, cy + 6); ctx.lineTo(cx - 17, cy);
        ctx.lineTo(cx - 17, cy + 24); ctx.lineTo(cx + 17, cy + 24); ctx.lineTo(cx + 17, cy);
        ctx.lineTo(cx + 24, cy + 6); ctx.lineTo(cx + 32, cy - 4); ctx.lineTo(cx + 17, cy - 16);
        ctx.closePath(); ctx.fill();
        // collar + belt
        ctx.strokeStyle = '#2f7440'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy - 15, 8, 0.3, Math.PI - 0.3); ctx.stroke();
        ctx.fillStyle = '#2f7440';
        ctx.fillRect(cx - 17, cy + 12, 34, 4);
        break;
      }
      case 'handyTool': {
        glow('rgba(200, 200, 210, 0.35)');
        ctx.strokeStyle = '#b8bec9'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(cx - 14, cy + 16); ctx.lineTo(cx + 10, cy - 8); ctx.stroke();
        // open wrench head
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(cx + 16, cy - 14, 11, Math.PI * 0.75, Math.PI * 2.05); ctx.stroke();
        ctx.strokeStyle = '#8a929e'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(cx - 14, cy + 16); ctx.lineTo(cx - 6, cy + 8); ctx.stroke();
        break;
      }
      case 'wristwatch': {
        glow('rgba(240, 166, 60, 0.35)');
        ctx.fillStyle = '#8a6d3a';
        ctx.fillRect(cx - 9, cy - 34, 18, 18);
        ctx.fillRect(cx - 9, cy + 16, 18, 18);
        circle(cx, cy, 19, '#c9a54e');
        circle(cx, cy, 14, '#f5efe0');
        ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7, cy + 3); ctx.stroke();
        break;
      }
      case 'superAmp': {
        // A bigger arrow: the shot itself, radiating "grow" arcs at the tip.
        glow('rgba(240, 166, 60, 0.4)');
        ctx.save();
        ctx.translate(cx + 14, cy);
        RA.drawArrowShape(ctx, RA.ARROWS.byId.default, 58);
        ctx.restore();
        ctx.strokeStyle = '#ffd23e';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(cx + 17, cy, 10 + i * 8, -0.85, 0.85);
          ctx.stroke();
        }
        break;
      }
      case 'eagleBoots': {
        glow('rgba(180, 130, 80, 0.35)');
        ctx.fillStyle = '#9a6d42';
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 22); ctx.lineTo(cx + 6, cy - 22);
        ctx.lineTo(cx + 6, cy + 8); ctx.lineTo(cx + 24, cy + 8);
        ctx.lineTo(cx + 24, cy + 20); ctx.lineTo(cx - 12, cy + 20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a5432';
        ctx.fillRect(cx - 12, cy + 14, 36, 6);
        // ankle wing
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.ellipse(cx - 16, cy - 2, 13, 5.5, -0.5, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 19, cy + 4, 10, 4, -0.4, 0, 7);
        ctx.fill();
        break;
      }
      case 'woodenVault': {
        glow('rgba(240, 192, 64, 0.4)');
        ctx.fillStyle = '#8a5f36';
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy - 6);
        ctx.arc(cx, cy - 6, 24, Math.PI, 0);
        ctx.lineTo(cx + 24, cy + 20); ctx.lineTo(cx - 24, cy + 20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6d4a28';
        ctx.fillRect(cx - 24, cy - 2, 48, 4);
        ctx.fillStyle = '#c9a54e';
        ctx.fillRect(cx - 4, cy - 8, 8, 12);
        // spilling coins
        circle(cx - 30, cy + 22, 5, '#f0c040');
        circle(cx + 31, cy + 20, 5, '#f0c040');
        circle(cx + 22, cy + 26, 4, '#d9a832');
        break;
      }
      case 'greatStamp': {
        glow('rgba(224, 69, 60, 0.35)');
        // stamp handle + base
        ctx.fillStyle = '#8a6d3a';
        ctx.fillRect(cx - 4, cy - 30, 8, 14);
        ctx.fillStyle = '#6d552e';
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 2); ctx.lineTo(cx + 18, cy - 2);
        ctx.lineTo(cx + 14, cy - 16); ctx.lineTo(cx - 14, cy - 16);
        ctx.closePath(); ctx.fill();
        // red heart imprint below
        ctx.fillStyle = '#d0453c';
        ctx.save();
        ctx.translate(cx, cy + 16);
        ctx.beginPath();
        ctx.arc(-6, 0, 8, 0, 7); ctx.arc(6, 0, 8, 0, 7);
        ctx.moveTo(-13, 4); ctx.lineTo(0, 18); ctx.lineTo(13, 4);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'license': {
        glow('rgba(240, 230, 200, 0.4)');
        ctx.fillStyle = '#f2ead8';
        ctx.fillRect(cx - 27, cy - 18, 54, 36);
        ctx.strokeStyle = '#c9a54e'; ctx.lineWidth = 2.5;
        ctx.strokeRect(cx - 27, cy - 18, 54, 36);
        ctx.fillStyle = '#8a8070';
        ctx.fillRect(cx - 20, cy - 9, 22, 3);
        ctx.fillRect(cx - 20, cy - 2, 30, 3);
        ctx.fillRect(cx - 20, cy + 5, 16, 3);
        circle(cx + 17, cy + 8, 7, 'rgba(192, 57, 43, 0.75)');
        break;
      }
      case 'licksKnife': {
        glow('rgba(200, 210, 220, 0.35)');
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.7);
        ctx.fillStyle = '#d4dae0';
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(7, -6); ctx.lineTo(0, -2); ctx.lineTo(-7, -6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6d3a';
        ctx.fillRect(-9, -3, 18, 5);
        ctx.fillStyle = '#5c4626';
        ctx.fillRect(-4, 2, 8, 22);
        ctx.restore();
        break;
      }
      case 'whiteBird': {
        glow('rgba(245, 245, 245, 0.4)');
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath(); ctx.ellipse(cx, cy + 4, 22, 13, 0, 0, 7); ctx.fill();
        // raised wing
        ctx.beginPath(); ctx.ellipse(cx - 8, cy - 12, 15, 7, -0.7, 0, 7); ctx.fill();
        // tail
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy + 2); ctx.lineTo(cx - 34, cy - 4); ctx.lineTo(cx - 30, cy + 8);
        ctx.closePath(); ctx.fill();
        // beak + eye
        ctx.fillStyle = '#f0a63c';
        ctx.beginPath();
        ctx.moveTo(cx + 21, cy); ctx.lineTo(cx + 33, cy - 3); ctx.lineTo(cx + 21, cy + 6);
        ctx.closePath(); ctx.fill();
        circle(cx + 12, cy - 2, 2.4, '#2e2e2e');
        break;
      }
      case 'blueBird': {
        glow('rgba(79, 143, 208, 0.4)');
        ctx.fillStyle = '#6aa8e0';
        ctx.beginPath(); ctx.ellipse(cx, cy, 20, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#4a86c2';
        ctx.beginPath(); ctx.ellipse(cx - 6, cy - 12, 13, 6, -0.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0a63c';
        ctx.beginPath();
        ctx.moveTo(cx + 19, cy - 3); ctx.lineTo(cx + 30, cy - 5); ctx.lineTo(cx + 19, cy + 3);
        ctx.closePath(); ctx.fill();
        circle(cx + 10, cy - 5, 2.4, '#2e2e2e');
        // the infamous payload
        circle(cx + 2, cy + 22, 3.5, '#8a6a4a');
        circle(cx, cy + 17, 2.5, '#8a6a4a');
        break;
      }
      case 'dwarfHunter':
      case 'dwarfWizard':
      case 'dwarfRogue':
      case 'dwarfHealer': {
        const glows = {
          dwarfHunter: 'rgba(168, 201, 138, 0.4)',
          dwarfWizard: 'rgba(159, 176, 224, 0.4)',
          dwarfRogue: 'rgba(154, 154, 165, 0.4)',
          dwarfHealer: 'rgba(143, 207, 154, 0.45)',
        };
        glow(glows[id]);
        // the actual in-game dwarf, blown up to portrait size
        ctx.save();
        ctx.translate(cx, cy + 30);
        ctx.scale(1.7, 1.7);
        RA.drawDwarf(ctx, 0, 0, id, 2.2, 0);
        ctx.restore();
        break;
      }
      case 'skullCache': {
        glow('rgba(200, 200, 200, 0.3)');
        circle(cx, cy - 4, 17, '#e8e4da');
        ctx.fillStyle = '#e8e4da';
        ctx.fillRect(cx - 9, cy + 6, 18, 10);
        circle(cx - 7, cy - 6, 4.5, '#3b3b3b');
        circle(cx + 7, cy - 6, 4.5, '#3b3b3b');
        ctx.fillStyle = '#3b3b3b';
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx - 3, cy + 5); ctx.lineTo(cx + 3, cy + 5);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(cx - 6, cy + 10, 3, 6);
        ctx.fillRect(cx - 1, cy + 10, 3, 6);
        ctx.fillRect(cx + 4, cy + 10, 3, 6);
        break;
      }
      default: {
        glow('rgba(255, 210, 62, 0.3)');
        ctx.fillStyle = '#f5efe6';
        ctx.font = '900 40px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', cx, cy + 14);
      }
    }
  };
})();
