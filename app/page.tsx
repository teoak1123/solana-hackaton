"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  compileFighterMind,
  compileMindFromActionList,
  determineFighterActionForStep,
  resolveKinematicCollision,
  LimbActionType,
  KinematicPoseState,
  KINEMATIC_POSES,
} from "@/lib/fighter-ai";
import { sfx } from "@/lib/retro-audio";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export default function FighterArena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Health Points
  const [p1Hp, setP1Hp] = useState<number>(100);
  const [p2Hp, setP2Hp] = useState<number>(100);

  // Prompts
  const [p1Prompt, setP1Prompt] = useState<string>("");
  const [p2Prompt, setP2Prompt] = useState<string>("");

  // Visual phase tracker
  const [activeStepP1, setActiveStepP1] = useState<number | null>(null);
  const [activeStepP2, setActiveStepP2] = useState<number | null>(null);

  // Wagering in SOL
  const [p1Wager, setP1Wager] = useState<number>(0.5);
  const [p2Wager, setP2Wager] = useState<number>(0.5);

  const [round, setRound] = useState<number>(1);
  const [winner, setWinner] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [log, setLog] = useState<string>("STANDBY. AWAITING INPUT.");

  // Progressive Frame States (Smooth 60FPS continuous joint kinematics)
  const stateRef = useRef({
    p1X: 70,
    p1Y: 96,
    p2X: 250,
    p2Y: 96,
    p1Pose: { ...KINEMATIC_POSES.NEUTRAL_GUARD } as KinematicPoseState,
    p2Pose: { ...KINEMATIC_POSES.NEUTRAL_GUARD } as KinematicPoseState,
    p1Action: "NEUTRAL_GUARD" as LimbActionType,
    p2Action: "NEUTRAL_GUARD" as LimbActionType,
    p1Hurt: 0,
    p2Hurt: 0,
    frame: 0,
    shake: 0,
    spark: null as { x: number; y: number; text?: string; color?: string } | null,
    particles: [] as Particle[],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    let animId: number;

    const render = () => {
      const state = stateRef.current;
      state.frame++;

      ctx.save();

      // Screen Shake on impact
      if (state.shake > 0) {
        const shakeX = (Math.random() - 0.5) * state.shake;
        const shakeY = (Math.random() - 0.5) * state.shake;
        ctx.translate(shakeX, shakeY);
        state.shake *= 0.88;
        if (state.shake < 0.2) state.shake = 0;
      }

      // 1. Arena Background
      ctx.fillStyle = "#07080e";
      ctx.fillRect(0, 0, 320, 180);

      // Cyber Grid
      ctx.strokeStyle = "#141524";
      ctx.lineWidth = 1;
      for (let x = 0; x < 320; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 180);
        ctx.stroke();
      }

      // Solana Gradient Horizon line
      const grad = ctx.createLinearGradient(0, 126, 320, 126);
      grad.addColorStop(0, "#9945FF");
      grad.addColorStop(0.5, "#14F195");
      grad.addColorStop(1, "#00C2FF");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 126);
      ctx.lineTo(320, 126);
      ctx.stroke();

      // Floor
      ctx.fillStyle = "#0a0c16";
      ctx.fillRect(0, 128, 320, 52);

      // Floor Grid markings
      ctx.strokeStyle = "#171a2e";
      for (let x = 0; x < 320; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 128);
        ctx.lineTo(x + 16, 180);
        ctx.stroke();
      }

      // Articulated pixel fighter renderer
      const drawArticulatedFighter = (
        x: number,
        y: number,
        pose: KinematicPoseState,
        action: LimbActionType,
        isHurt: number,
        isP1: boolean
      ) => {
        ctx.save();
        const dir = isP1 ? 1 : -1;
        const primaryColor = isHurt > 0 ? "#ef4444" : isP1 ? "#9945FF" : "#14F195";
        const secondaryColor = isP1 ? "#14F195" : "#38bdf8";
        const darkColor = "#1a1b2f";
        const goldColor = "#facc15";

        const torsoBaseY = y + pose.torsoOffsetY;

        // Shadow under fighter
        if (!pose.isAirborne) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.beginPath();
          ctx.ellipse(x, 128, 16 + pose.legExtensionPx * 0.4, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // rear leg
        ctx.fillStyle = darkColor;
        if (action === "CROUCH_DUCK") {
          // Deep crouch bent knee
          ctx.fillStyle = primaryColor;
          ctx.fillRect(x - 10 * dir, torsoBaseY + 12, 10, 8);
          ctx.fillRect(x - 14 * dir, torsoBaseY + 18, 12, 6);
        } else if (action === "AERIAL_KICK") {
          // Aerodynamic tucked rear leg
          ctx.fillStyle = darkColor;
          ctx.fillRect(x - 10 * dir, torsoBaseY + 6, 8, 8);
        } else if (pose.legExtensionPx > 0) {
          // Low sweep leg extended flat along the floor!
          ctx.fillStyle = primaryColor;
          const sweepLength = 14 + pose.legExtensionPx;
          // Knee touching ground
          ctx.fillRect(x - 8 * dir, torsoBaseY + 16, 8, 12);
          // Leg shooting across floor
          ctx.fillRect(x + 2 * dir, torsoBaseY + 22, sweepLength * dir, 7);
          // Heavy boot at the tip of the kick
          ctx.fillStyle = goldColor;
          ctx.fillRect(x + (2 + sweepLength) * dir - (dir > 0 ? 0 : 6), torsoBaseY + 20, 6, 9);
        } else if (pose.isAirborne) {
          ctx.fillRect(x - 6 * dir, torsoBaseY + 14, 6, 10);
        } else {
          ctx.fillRect(x - 6 * dir, torsoBaseY + 16, 6, 14);
          ctx.fillStyle = primaryColor;
          ctx.fillRect(x - 8 * dir, torsoBaseY + 26, 8, 4);
        }

        // torso and core armor
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x - 9, torsoBaseY, 18, 18);
        ctx.fillStyle = darkColor;
        ctx.fillRect(x - 7, torsoBaseY + 4, 14, 10);
        // Energy Reactor in chest
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(x - 3, torsoBaseY + 6, 6, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 1, torsoBaseY + 8, 2, 2);

        // front leg
        if (action === "CROUCH_DUCK") {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(x + 2 * dir, torsoBaseY + 12, 10, 8);
          ctx.fillRect(x + 6 * dir, torsoBaseY + 18, 10, 6);
        } else if (action === "AERIAL_KICK") {
          // Full flying dropkick thrust
          ctx.fillStyle = primaryColor;
          ctx.fillRect(x + 2 * dir, torsoBaseY + 4, 22 * dir, 7);
          ctx.fillStyle = goldColor;
          ctx.fillRect(x + 22 * dir, torsoBaseY + 2, 8 * dir, 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x + 28 * dir, torsoBaseY + 4, 4 * dir, 6);
        } else if (pose.legExtensionPx === 0) {
          ctx.fillStyle = primaryColor;
          if (action === "MID_LEG_KICK") {
            ctx.fillRect(x + 2 * dir, torsoBaseY + 14, 16 * dir, 6);
            ctx.fillStyle = goldColor;
            ctx.fillRect(x + 16 * dir, torsoBaseY + 12, 6 * dir, 8);
          } else if (pose.isAirborne) {
            ctx.fillRect(x + 2 * dir, torsoBaseY + 14, 6, 10);
          } else {
            ctx.fillRect(x + 2 * dir, torsoBaseY + 16, 6, 14);
            ctx.fillStyle = darkColor;
            ctx.fillRect(x + 2 * dir, torsoBaseY + 26, 8, 4);
          }
        }

        // head and visor
        const headX = x + pose.headOffsetX * dir;
        const headY = torsoBaseY - 14 + pose.headOffsetY;

        ctx.fillStyle = primaryColor;
        ctx.fillRect(headX - 7, headY, 14, 14);
        // Helmet Crest
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(headX - 4, headY - 3, 8, 4);
        // Visor slit
        ctx.fillStyle = isHurt > 0 ? "#ffffff" : isP1 ? "#ffffff" : "#facc15";
        ctx.fillRect(headX + (dir > 0 ? 0 : -6), headY + 4, 7, 3);

        // Headbutt Kinetic Aura
        if (action === "HEADBUTT_THRUST") {
          ctx.fillStyle = goldColor;
          ctx.fillRect(headX + 8 * dir - (dir > 0 ? 0 : 6), headY + 1, 6, 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(headX + 6 * dir - (dir > 0 ? 0 : 4), headY + 3, 4, 6);
        }

        // arms
        const shoulderX = x + 4 * dir;
        const shoulderY = torsoBaseY + 4;

        if (action === "CROUCH_DUCK") {
          // Low defensive guard tucked in
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY + 2, 8 * dir, 6);
          ctx.fillRect(shoulderX + 6 * dir, shoulderY - 2, 6, 8);
        } else if (action === "AERIAL_JUMP") {
          // Dynamic jumping tucked arms
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX - 4 * dir, shoulderY - 8, 7, 10);
          ctx.fillRect(shoulderX + 4 * dir, shoulderY - 14, 6, 8);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + 3 * dir, shoulderY - 18, 8, 6);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(shoulderX + 5 * dir, shoulderY - 16, 4, 4);
        } else if (action === "AERIAL_KICK") {
          // Aerodynamic swept-back arms
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX - 8 * dir, shoulderY - 2, 8 * dir, 6);
          ctx.fillRect(shoulderX - 14 * dir, shoulderY - 4, 8 * dir, 5);
        } else if (action === "RAISE_ARM_HIGH") {
          // Lifts arm high into the sky above the helmet!
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY - 8, 6, 10);
          ctx.fillRect(shoulderX + 2 * dir, shoulderY - 20, 6, 14);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + 1 * dir, shoulderY - 26, 8, 8);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(shoulderX + 3 * dir, shoulderY - 24, 4, 4);
        } else if (action === "PUNCH_STRIKE") {
          ctx.fillStyle = primaryColor;
          const punchLen = 14 + pose.armExtensionPx;
          ctx.fillRect(shoulderX, shoulderY - 2, punchLen * dir, 6);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + punchLen * dir - (dir > 0 ? 0 : 8), shoulderY - 4, 8, 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(shoulderX + (punchLen - 2) * dir, shoulderY - 2, 4, 6);
        } else if (action === "UPPERCUT_LIFT") {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY - 4, 6, 12);
          ctx.fillRect(shoulderX + 4 * dir, shoulderY - 18, 7, 16);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + 3 * dir, shoulderY - 24, 9, 9);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(shoulderX + 5 * dir, shoulderY - 22, 5, 5);
        } else if (action === "FLYING_KNEE") {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX - 4 * dir, shoulderY + 2, 8 * dir, 6);
          ctx.fillRect(x + 4 * dir, torsoBaseY + 6, 14 * dir, 8);
          ctx.fillStyle = goldColor;
          ctx.fillRect(x + 16 * dir, torsoBaseY + 4, 8 * dir, 10);
        } else if (action === "SPINNING_BACKFIST") {
          ctx.fillStyle = primaryColor;
          const spinLen = 16 + pose.armExtensionPx;
          ctx.fillRect(shoulderX - 4 * dir, shoulderY, spinLen * dir, 6);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + spinLen * dir - (dir > 0 ? 0 : 8), shoulderY - 3, 9, 9);
        } else if (pose.isShieldActive) {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY, 10 * dir, 8);
          ctx.fillRect(shoulderX + 6 * dir, shoulderY - 4, 6, 12);

          // Energy Shield Barrier
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(shoulderX + 12 * dir - (dir > 0 ? 0 : 8), shoulderY - 16, 8, 42);
          ctx.fillStyle = "rgba(20, 241, 149, 0.25)";
          ctx.fillRect(shoulderX + 12 * dir - (dir > 0 ? 0 : 8), shoulderY - 16, 8, 42);
        } else if (action === "ARM_FEINT_WAVE") {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY - 10, 10 * dir, 6);
          ctx.fillStyle = goldColor;
          ctx.fillRect(shoulderX + 8 * dir, shoulderY - 14, 6, 6);
        } else {
          ctx.fillStyle = primaryColor;
          ctx.fillRect(shoulderX, shoulderY, 8 * dir, 6);
          ctx.fillRect(shoulderX + 6 * dir, shoulderY - 4, 5, 6);
        }

        ctx.restore();
      };

      // Draw P1 (Titan)
      drawArticulatedFighter(
        state.p1X,
        state.p1Y,
        state.p1Pose,
        state.p1Action,
        state.p1Hurt,
        true
      );

      // Draw P2 (Viper)
      drawArticulatedFighter(
        state.p2X,
        state.p2Y,
        state.p2Pose,
        state.p2Action,
        state.p2Hurt,
        false
      );

      if (state.p1Hurt > 0) state.p1Hurt--;
      if (state.p2Hurt > 0) state.p2Hurt--;

      // Particles (Dust & Sparks)
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Dynamic Impact Text / Spark
      if (state.spark) {
        const { x, y, text, color } = state.spark;
        ctx.fillStyle = color || "#facc15";
        ctx.fillRect(x - 8, y - 8, 16, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 4, y - 4, 8, 8);
        if (text) {
          ctx.font = "8px 'Press Start 2P', monospace";
          ctx.fillStyle = color || "#14F195";
          ctx.fillText(text, x - 26, y - 14);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Frame interpolation helper
  const animateKinematicTransition = async (
    targetP1X: number,
    targetP2X: number,
    targetP1Pose: KinematicPoseState,
    targetP2Pose: KinematicPoseState,
    steps: number = 10,
    stepIntervalMs: number = 20
  ) => {
    const s = stateRef.current;
    const dx1 = (targetP1X - s.p1X) / steps;
    const dx2 = (targetP2X - s.p2X) / steps;

    for (let i = 0; i < steps; i++) {
      s.p1X += dx1;
      s.p2X += dx2;

      s.p1Pose = {
        headOffsetY: s.p1Pose.headOffsetY + (targetP1Pose.headOffsetY - s.p1Pose.headOffsetY) / (steps - i),
        headOffsetX: s.p1Pose.headOffsetX + (targetP1Pose.headOffsetX - s.p1Pose.headOffsetX) / (steps - i),
        torsoOffsetY: s.p1Pose.torsoOffsetY + (targetP1Pose.torsoOffsetY - s.p1Pose.torsoOffsetY) / (steps - i),
        armAngleDeg: s.p1Pose.armAngleDeg + (targetP1Pose.armAngleDeg - s.p1Pose.armAngleDeg) / (steps - i),
        armExtensionPx: s.p1Pose.armExtensionPx + (targetP1Pose.armExtensionPx - s.p1Pose.armExtensionPx) / (steps - i),
        legAngleDeg: s.p1Pose.legAngleDeg + (targetP1Pose.legAngleDeg - s.p1Pose.legAngleDeg) / (steps - i),
        legExtensionPx: s.p1Pose.legExtensionPx + (targetP1Pose.legExtensionPx - s.p1Pose.legExtensionPx) / (steps - i),
        isShieldActive: targetP1Pose.isShieldActive,
        isAirborne: targetP1Pose.isAirborne,
      };

      s.p2Pose = {
        headOffsetY: s.p2Pose.headOffsetY + (targetP2Pose.headOffsetY - s.p2Pose.headOffsetY) / (steps - i),
        headOffsetX: s.p2Pose.headOffsetX + (targetP2Pose.headOffsetX - s.p2Pose.headOffsetX) / (steps - i),
        torsoOffsetY: s.p2Pose.torsoOffsetY + (targetP2Pose.torsoOffsetY - s.p2Pose.torsoOffsetY) / (steps - i),
        armAngleDeg: s.p2Pose.armAngleDeg + (targetP2Pose.armAngleDeg - s.p2Pose.armAngleDeg) / (steps - i),
        armExtensionPx: s.p2Pose.armExtensionPx + (targetP2Pose.armExtensionPx - s.p2Pose.armExtensionPx) / (steps - i),
        legAngleDeg: s.p2Pose.legAngleDeg + (targetP2Pose.legAngleDeg - s.p2Pose.legAngleDeg) / (steps - i),
        legExtensionPx: s.p2Pose.legExtensionPx + (targetP2Pose.legExtensionPx - s.p2Pose.legExtensionPx) / (steps - i),
        isShieldActive: targetP2Pose.isShieldActive,
        isAirborne: targetP2Pose.isAirborne,
      };

      await wait(stepIntervalMs);
    }
  };

  // Execute progressive multi-step sequence
  const executeCombat = async () => {
    if (simulating || winner) return;
    sfx.unlock();
    setSimulating(true);

    let mind1 = compileFighterMind(p1Prompt);
    let mind2 = compileFighterMind(p2Prompt);

    try {
      setLog("INTERPRETING DIRECTIVES...");
      const res = await fetch("/api/battle/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p1Prompt, p2Prompt }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.p1Policy && data.p1Policy.actions?.length > 0) {
          mind1 = compileMindFromActionList(data.p1Policy.actions, p1Prompt, data.p1Policy);
        } else if (data.p1Actions && Array.isArray(data.p1Actions) && data.p1Actions.length > 0) {
          mind1 = compileMindFromActionList(data.p1Actions, p1Prompt);
        }
        if (data.p2Policy && data.p2Policy.actions?.length > 0) {
          mind2 = compileMindFromActionList(data.p2Policy.actions, p2Prompt, data.p2Policy);
        } else if (data.p2Actions && Array.isArray(data.p2Actions) && data.p2Actions.length > 0) {
          mind2 = compileMindFromActionList(data.p2Actions, p2Prompt);
        }
      }
    } catch {
      // Local fallback in case of network or API failure
    }

    const p1Steps = mind1.commands.length;
    const p2Steps = mind2.commands.length;
    const isP1Reactive = mind1.policy?.repeatPolicy === "ON_EVERY_ATTACK" || !!mind1.policy?.reactiveTrigger?.whenOpponentAttacks;
    const isP2Reactive = mind2.policy?.repeatPolicy === "ON_EVERY_ATTACK" || !!mind2.policy?.reactiveTrigger?.whenOpponentAttacks;

    const totalPhases = Math.max(
      p1Steps,
      p2Steps,
      isP1Reactive ? p2Steps : 1,
      isP2Reactive ? p1Steps : 1,
      1
    );

    let currentP1Hp = p1Hp;
    let currentP2Hp = p2Hp;

    for (let step = 0; step < totalPhases; step++) {
      if (currentP1Hp <= 0 || currentP2Hp <= 0) break;

      setActiveStepP1(step < mind1.commands.length ? step : null);
      setActiveStepP2(step < mind2.commands.length ? step : null);

      const p1Intended = mind1.commands[step % (mind1.commands.length || 1)]?.action;
      const p2Intended = mind2.commands[step % (mind2.commands.length || 1)]?.action;

      const cmd1 = determineFighterActionForStep(mind1, step, p2Intended);
      const cmd2 = determineFighterActionForStep(mind2, step, p1Intended);

      const collision = resolveKinematicCollision(cmd1, cmd2, mind1.tactics, mind2.tactics);

      stateRef.current.p1Action = collision.p1Action;
      stateRef.current.p2Action = collision.p2Action;

      // Audio triggers
      if (collision.p1Action === "HEADBUTT_THRUST" || collision.p2Action === "HEADBUTT_THRUST") {
        sfx.playHeadbutt();
      } else if (collision.p1Action === "SHIELD_BLOCK" || collision.p2Action === "SHIELD_BLOCK") {
        sfx.playBlock();
      } else if (
        collision.p1Action === "RAISE_ARM_HIGH" ||
        collision.p2Action === "RAISE_ARM_HIGH" ||
        collision.p1Action === "ARM_FEINT_WAVE" ||
        collision.p2Action === "ARM_FEINT_WAVE"
      ) {
        sfx.playFeint();
      } else if (
        collision.p1Action === "AERIAL_JUMP" ||
        collision.p2Action === "AERIAL_JUMP" ||
        collision.p1Action === "AERIAL_KICK" ||
        collision.p2Action === "AERIAL_KICK" ||
        collision.p1Action === "FLYING_KNEE" ||
        collision.p2Action === "FLYING_KNEE"
      ) {
        sfx.playJump();
        if (
          collision.p1Action === "AERIAL_KICK" ||
          collision.p2Action === "AERIAL_KICK" ||
          collision.p1Action === "FLYING_KNEE" ||
          collision.p2Action === "FLYING_KNEE"
        ) {
          setTimeout(() => sfx.playPunch(), 120);
        }
      } else if (
        collision.p1Action === "PUNCH_STRIKE" ||
        collision.p1Action === "MID_LEG_KICK" ||
        collision.p1Action === "LOW_LEG_SWEEP" ||
        collision.p1Action === "UPPERCUT_LIFT" ||
        collision.p1Action === "SPINNING_BACKFIST" ||
        collision.p2Action === "PUNCH_STRIKE" ||
        collision.p2Action === "MID_LEG_KICK" ||
        collision.p2Action === "LOW_LEG_SWEEP" ||
        collision.p2Action === "UPPERCUT_LIFT" ||
        collision.p2Action === "SPINNING_BACKFIST"
      ) {
        sfx.playPunch();
      }

      // Compute physical coordinates
      let targetX1 = 70;
      let targetX2 = 250;

      if (collision.p1Action === "LOW_LEG_SWEEP") {
        targetX1 = 125;
        for (let k = 0; k < 6; k++) {
          stateRef.current.particles.push({
            x: targetX1 + 10,
            y: 126,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            life: 15,
            maxLife: 15,
            color: "#64748b",
          });
        }
      } else if (collision.p1Action === "AERIAL_KICK") {
        targetX1 = 145; // Rockets forward in air!
        for (let k = 0; k < 4; k++) {
          stateRef.current.particles.push({
            x: targetX1 - 10,
            y: 90,
            vx: -Math.random() * 3,
            vy: (Math.random() - 0.5) * 2,
            life: 18,
            maxLife: 18,
            color: "#14F195",
          });
        }
      } else if (collision.p1Action === "PUNCH_STRIKE" || collision.p1Action === "MID_LEG_KICK") {
        targetX1 = 120;
      } else if (collision.p1Action === "HEADBUTT_THRUST") {
        targetX1 = 135;
      } else if (collision.p1Action === "UPPERCUT_LIFT") {
        targetX1 = 120;
      } else if (collision.p1Action === "FLYING_KNEE") {
        targetX1 = 140;
      } else if (collision.p1Action === "SPINNING_BACKFIST") {
        targetX1 = 125;
      } else if (collision.p1Action === "RAISE_ARM_HIGH") {
        targetX1 = 95;
      } else if (collision.p1Action === "CROUCH_DUCK") {
        targetX1 = 80;
      } else if (collision.p1Action === "EVASIVE_DODGE") {
        targetX1 = 40;
      } else if (collision.p1Action === "AERIAL_JUMP") {
        targetX1 = 75;
        for (let k = 0; k < 6; k++) {
          stateRef.current.particles.push({
            x: 70 + (Math.random() - 0.5) * 16,
            y: 126,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            life: 14,
            maxLife: 14,
            color: "#38bdf8",
          });
        }
      }

      if (collision.p2Action === "LOW_LEG_SWEEP") {
        targetX2 = 195;
        for (let k = 0; k < 6; k++) {
          stateRef.current.particles.push({
            x: targetX2 - 10,
            y: 126,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            life: 15,
            maxLife: 15,
            color: "#64748b",
          });
        }
      } else if (collision.p2Action === "AERIAL_KICK") {
        targetX2 = 175; // Rockets forward in air!
        for (let k = 0; k < 4; k++) {
          stateRef.current.particles.push({
            x: targetX2 + 10,
            y: 90,
            vx: Math.random() * 3,
            vy: (Math.random() - 0.5) * 2,
            life: 18,
            maxLife: 18,
            color: "#38bdf8",
          });
        }
      } else if (collision.p2Action === "PUNCH_STRIKE" || collision.p2Action === "MID_LEG_KICK") {
        targetX2 = 200;
      } else if (collision.p2Action === "HEADBUTT_THRUST") {
        targetX2 = 185;
      } else if (collision.p2Action === "UPPERCUT_LIFT") {
        targetX2 = 200;
      } else if (collision.p2Action === "FLYING_KNEE") {
        targetX2 = 180;
      } else if (collision.p2Action === "SPINNING_BACKFIST") {
        targetX2 = 195;
      } else if (collision.p2Action === "RAISE_ARM_HIGH") {
        targetX2 = 225;
      } else if (collision.p2Action === "CROUCH_DUCK") {
        targetX2 = 240;
      } else if (collision.p2Action === "EVASIVE_DODGE") {
        targetX2 = 280;
      } else if (collision.p2Action === "AERIAL_JUMP") {
        targetX2 = 245;
        for (let k = 0; k < 6; k++) {
          stateRef.current.particles.push({
            x: 250 + (Math.random() - 0.5) * 16,
            y: 126,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2,
            life: 14,
            maxLife: 14,
            color: "#38bdf8",
          });
        }
      }

      // Smooth kinematic interpolation
      await animateKinematicTransition(targetX1, targetX2, collision.p1Pose, collision.p2Pose, 8, 22);

      // Collision Sparks & Damage
      if (collision.outcomeType === "CLASH_TRADE") {
        sfx.playClash();
        stateRef.current.shake = 6;
        stateRef.current.spark = { x: 160, y: 90, text: "CLASH", color: "#facc15" };
      } else if (collision.outcomeType === "SHIELD_ABSORB") {
        sfx.playBlock();
        stateRef.current.shake = 3;
        const blockerX = collision.p1Action === "SHIELD_BLOCK" ? targetX1 : targetX2;
        stateRef.current.spark = {
          x: blockerX,
          y: 75,
          text: "BLOCKED",
          color: "#14F195",
        };
      } else if (
        collision.outcomeType === "HIGH_DUCK_EVASION" ||
        (collision.outcomeType === "NEUTRAL_REPOSITION" && (collision.p1Action === "AERIAL_JUMP" || collision.p1Action === "CROUCH_DUCK" || collision.p2Action === "AERIAL_JUMP" || collision.p2Action === "CROUCH_DUCK"))
      ) {
        sfx.playFeint();
        stateRef.current.shake = 2;
        const isJump = collision.p1Action === "AERIAL_JUMP" || collision.p2Action === "AERIAL_JUMP";
        const isDuck = collision.p1Action === "CROUCH_DUCK" || collision.p2Action === "CROUCH_DUCK";
        stateRef.current.spark = {
          x: collision.p1Action === "AERIAL_JUMP" || collision.p1Action === "CROUCH_DUCK" ? targetX1 : targetX2,
          y: isJump ? 52 : 110,
          text: isJump ? "EVADED" : isDuck ? "WEAVED" : "DODGED",
          color: isJump ? "#14F195" : "#38bdf8",
        };
      } else if (collision.p1Damage > 0 || collision.p2Damage > 0) {
        sfx.playHit();
        stateRef.current.shake = collision.p1Damage > 20 || collision.p2Damage > 20 ? 8 : 4;

        if (collision.p1Damage > 0) stateRef.current.p1Hurt = 12;
        if (collision.p2Damage > 0) stateRef.current.p2Hurt = 12;

        stateRef.current.spark = {
          x: collision.p1Damage > 0 ? targetX1 : targetX2,
          y: collision.outcomeType === "UNDER_SWEEP_PUNISH" ? 116 : 80,
          text:
            collision.outcomeType === "UNDER_SWEEP_PUNISH"
              ? "TRIPPED"
              : collision.outcomeType === "AERIAL_OVER_SWEEP"
              ? "PUNISH"
              : collision.outcomeType === "ADAPTIVE_COUNTER_HIT" ||
                collision.outcomeType === "WHIFF_RECOVERY_PUNISH"
              ? "COUNTER"
              : "HIT",
          color:
            collision.outcomeType === "UNDER_SWEEP_PUNISH"
              ? "#facc15"
              : collision.outcomeType === "WHIFF_RECOVERY_PUNISH"
              ? "#38bdf8"
              : "#ef4444",
        };
      }

      setLog(collision.narrative);
      currentP1Hp = Math.max(0, currentP1Hp - collision.p1Damage);
      currentP2Hp = Math.max(0, currentP2Hp - collision.p2Damage);
      setP1Hp(currentP1Hp);
      setP2Hp(currentP2Hp);

      await wait(450);
      stateRef.current.spark = null;

      // Recovery to neutral
      await animateKinematicTransition(
        70,
        250,
        KINEMATIC_POSES.NEUTRAL_GUARD,
        KINEMATIC_POSES.NEUTRAL_GUARD,
        7,
        20
      );
      stateRef.current.p1Action = "NEUTRAL_GUARD";
      stateRef.current.p2Action = "NEUTRAL_GUARD";
      await wait(120);
    }

    setActiveStepP1(null);
    setActiveStepP2(null);

    // K.O. evaluation
    if (currentP1Hp <= 0 && currentP2Hp <= 0) {
      setWinner("DRAW");
      sfx.playKO();
      setLog("DRAW. WAGERS REFUNDED.");
    } else if (currentP1Hp <= 0) {
      setWinner("P2");
      sfx.playKO();
      setLog(`VIPER WINS. ${(p1Wager + p2Wager).toFixed(2)} SOL TRANSFERRED.`);
    } else if (currentP2Hp <= 0) {
      setWinner("P1");
      sfx.playKO();
      setLog(`TITAN WINS. ${(p1Wager + p2Wager).toFixed(2)} SOL TRANSFERRED.`);
    } else {
      setRound((r) => r + 1);
    }

    setSimulating(false);
  };

  const reset = () => {
    setP1Hp(100);
    setP2Hp(100);
    setRound(1);
    setWinner(null);
    setActiveStepP1(null);
    setActiveStepP2(null);
    setLog("STANDBY. AWAITING INPUT.");
    stateRef.current.p1X = 70;
    stateRef.current.p2X = 250;
    stateRef.current.p1Pose = { ...KINEMATIC_POSES.NEUTRAL_GUARD };
    stateRef.current.p2Pose = { ...KINEMATIC_POSES.NEUTRAL_GUARD };
    stateRef.current.p1Action = "NEUTRAL_GUARD";
    stateRef.current.p2Action = "NEUTRAL_GUARD";
    stateRef.current.p1Hurt = 0;
    stateRef.current.p2Hurt = 0;
  };

  return (
    <div
      onClick={() => sfx.unlock()}
      style={{
        minHeight: "100vh",
        backgroundColor: "#07080e",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: "border-box",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "13px",
              color: "#10b981",
              letterSpacing: "0.5px",
            }}
          >
            PROMPT FIGHT
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontFamily: "monospace",
              letterSpacing: "0.5px",
            }}
          >
            WHO WRITES THE BEST PROMPT?
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", fontFamily: "monospace" }}>
          <span style={{ color: "#f59e0b" }}>
            ESCROW: <span style={{ fontWeight: "bold" }}>{(p1Wager + p2Wager).toFixed(2)} SOL</span>
          </span>
          <span style={{ color: "#64748b" }}>ROUND {round}</span>
        </div>
      </div>

      {/* Screen Frame */}
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          border: "1px solid #1e243b",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "#090b14",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Health Bars */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            backgroundColor: "#0b0e18",
            borderBottom: "1px solid #161a29",
          }}
        >
          {/* P1 */}
          <div style={{ width: "44%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: "#a855f7" }}>
                TITAN
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "bold", color: "#c084fc" }}>
                {p1Hp} HP
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "12px",
                backgroundColor: "#18112e",
                borderRadius: "3px",
                overflow: "hidden",
                border: "1px solid #3b1875",
              }}
            >
              <div
                style={{
                  width: `${p1Hp}%`,
                  height: "100%",
                  backgroundColor: "#8b5cf6",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "10px",
              color: "#64748b",
            }}
          >
            VS
          </span>

          {/* P2 */}
          <div style={{ width: "44%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "bold", color: "#34d399" }}>
                {p2Hp} HP
              </span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "9px", color: "#10b981" }}>
                VIPER
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "12px",
                backgroundColor: "#0a2118",
                borderRadius: "3px",
                overflow: "hidden",
                border: "1px solid #065f46",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  width: `${p2Hp}%`,
                  height: "100%",
                  backgroundColor: "#10b981",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* 60FPS Articulated Canvas */}
        <canvas
          ref={canvasRef}
          width={320}
          height={180}
          style={{
            width: "100%",
            height: "290px",
            display: "block",
            imageRendering: "pixelated",
          }}
        />

        {/* Action Status Bar */}
        <div
          style={{
            padding: "9px 14px",
            backgroundColor: "#07080e",
            borderTop: "1px solid #161a29",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#fbbf24",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ color: "#10b981", fontWeight: "bold" }}>&gt;</span>
          <span>{log}</span>
        </div>
      </div>

      {/* Prompts Section with Step Execution */}
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        {/* P1 Controls */}
        <div
          style={{
            backgroundColor: "#0b0e18",
            border: "1px solid #2e1065",
            borderRadius: "8px",
            padding: "12px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "#c084fc" }}>
              P1 · TITAN
            </span>
            <div style={{ fontSize: "11px", color: "#f59e0b", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>WAGER:</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                disabled={simulating || winner !== null}
                value={p1Wager}
                onChange={(e) => setP1Wager(parseFloat(e.target.value) || 0.1)}
                style={{
                  width: "48px",
                  background: "#05060b",
                  border: "1px solid #3b1875",
                  borderRadius: "3px",
                  color: "#f59e0b",
                  padding: "2px 4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
              <span>SOL</span>
            </div>
          </div>

          <textarea
            maxLength={180}
            rows={2}
            value={p1Prompt}
            disabled={simulating || winner !== null}
            onChange={(e) => setP1Prompt(e.target.value)}
            placeholder="e.g. duck, dodge and counter punch"
            style={{
              width: "100%",
              backgroundColor: "#05060b",
              border: "1px solid #3b1875",
              color: "#f1f5f9",
              fontSize: "11px",
              lineHeight: "1.4",
              padding: "8px 10px",
              borderRadius: "5px",
              outline: "none",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              boxSizing: "border-box",
              resize: "none",
            }}
          />
        </div>

        {/* P2 Controls */}
        <div
          style={{
            backgroundColor: "#0b0e18",
            border: "1px solid #064e3b",
            borderRadius: "8px",
            padding: "12px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px", color: "#34d399" }}>
              P2 · VIPER
            </span>
            <div style={{ fontSize: "11px", color: "#f59e0b", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>WAGER:</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                disabled={simulating || winner !== null}
                value={p2Wager}
                onChange={(e) => setP2Wager(parseFloat(e.target.value) || 0.1)}
                style={{
                  width: "48px",
                  background: "#05060b",
                  border: "1px solid #065f46",
                  borderRadius: "3px",
                  color: "#f59e0b",
                  padding: "2px 4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
              <span>SOL</span>
            </div>
          </div>

          <textarea
            maxLength={180}
            rows={2}
            value={p2Prompt}
            disabled={simulating || winner !== null}
            onChange={(e) => setP2Prompt(e.target.value)}
            placeholder="e.g. jump, high kick and shield block"
            style={{
              width: "100%",
              backgroundColor: "#05060b",
              border: "1px solid #065f46",
              color: "#f1f5f9",
              fontSize: "11px",
              lineHeight: "1.4",
              padding: "8px 10px",
              borderRadius: "5px",
              outline: "none",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              boxSizing: "border-box",
              resize: "none",
            }}
          />
        </div>
      </div>

      {/* Button */}
      <div style={{ width: "100%", maxWidth: "700px", marginTop: "14px" }}>
        {winner ? (
          <button
            onClick={reset}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: "#10b981",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "bold",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "'Press Start 2P', monospace",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
              transition: "background-color 0.2s ease",
            }}
          >
            REMATCH
          </button>
        ) : (
          <button
            onClick={executeCombat}
            disabled={simulating}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: "#7c3aed",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "bold",
              border: "none",
              borderRadius: "6px",
              cursor: simulating ? "not-allowed" : "pointer",
              opacity: simulating ? 0.6 : 1,
              fontFamily: "'Press Start 2P', monospace",
              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
              transition: "background-color 0.2s ease",
            }}
          >
            {simulating ? "SIMULATING MATCH..." : "FIGHT"}
          </button>
        )}
      </div>
    </div>
  );
}
