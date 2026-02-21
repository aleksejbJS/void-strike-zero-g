import { WeaponType } from '../../types';

export const initAudio = () => {
    // No-op on server
};

export const playSound = (type: 'shoot' | 'hit' | 'explosion' | 'jump' | 'pickup' | 'shell' | 'score', weaponType?: WeaponType, isMuted: boolean = false) => {
    // No-op on server
};
