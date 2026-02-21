import { describe, it, test, expect, beforeEach } from 'vitest';
import { achievementManager, trackKill, trackFlagCapture, trackItemPickup } from './achievements';
import { WeaponType } from '../../types';

describe('Achievement System', () => {
  beforeEach(() => {
    // Reset achievements before each test
    localStorage.clear();
    // Reinitialize the manager
    achievementManager.getAchievements(); // This will reload from localStorage
  });

  describe('Basic Achievement Tracking', () => {
    test('should track first blood achievement', () => {
      trackKill(WeaponType.MACHINE_GUN);
      const achievements = achievementManager.getAchievements();
      const firstBlood = achievements.find(a => a.id === 'first_blood');

      expect(firstBlood?.progress).toBe(1);
      expect(firstBlood?.unlocked).toBe(true);
    });

    test('should track multiple kills for killer achievement', () => {
      // Track 10 kills
      for (let i = 0; i < 10; i++) {
        trackKill(WeaponType.MACHINE_GUN);
      }

      const achievements = achievementManager.getAchievements();
      const killer = achievements.find(a => a.id === 'killer');

      expect(killer?.progress).toBe(10);
      expect(killer?.unlocked).toBe(true);
    });

    test('should track flag captures', () => {
      trackFlagCapture();
      const achievements = achievementManager.getAchievements();
      const flagCapturer = achievements.find(a => a.id === 'flag_capturer');

      expect(flagCapturer?.progress).toBe(1);
    });

    test('should track item pickups', () => {
      // Track 100 pickups
      for (let i = 0; i < 100; i++) {
        trackItemPickup();
      }

      const achievements = achievementManager.getAchievements();
      const collector = achievements.find(a => a.id === 'collector');

      expect(collector?.progress).toBe(100);
      expect(collector?.unlocked).toBe(true);
    });
  });

  describe('Weapon Specific Achievements', () => {
    test('should track chainsaw kills', () => {
      for (let i = 0; i < 25; i++) {
        trackKill(WeaponType.CHAINSAW);
      }

      const achievements = achievementManager.getAchievements();
      const chainsawMaster = achievements.find(a => a.id === 'chainsaw_master');

      expect(chainsawMaster?.progress).toBe(25);
      expect(chainsawMaster?.unlocked).toBe(true);
    });

    test('should track railgun kills', () => {
      for (let i = 0; i < 20; i++) {
        trackKill(WeaponType.RAILGUN);
      }

      const achievements = achievementManager.getAchievements();
      const sniper = achievements.find(a => a.id === 'sniper');

      expect(sniper?.progress).toBe(20);
      expect(sniper?.unlocked).toBe(true);
    });
  });

  describe('XP and Progress Tracking', () => {
    test('should calculate total XP correctly', () => {
      trackKill(WeaponType.MACHINE_GUN); // First blood: 10 XP
      trackFlagCapture(); // Not an achievement that gives XP directly

      const totalXP = achievementManager.getTotalXP();
      expect(totalXP).toBe(10);
    });

    test('should calculate completion percentage', () => {
      trackKill(WeaponType.MACHINE_GUN); // Unlock first blood

      const percentage = achievementManager.getCompletionPercentage();
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Achievement Persistence', () => {
    test('should persist achievements in localStorage', () => {
      trackKill(WeaponType.MACHINE_GUN);

      // Create new manager instance (simulating page reload)
      const newManager = require('./achievements').achievementManager;
      const achievements = newManager.getAchievements();
      const firstBlood = achievements.find(a => a.id === 'first_blood');

      expect(firstBlood?.unlocked).toBe(true);
    });
  });
});
