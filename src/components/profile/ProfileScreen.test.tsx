import { describe, it, expect } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { ACHIEVEMENTS, achievementManager } from '../../game/systems/achievements';
import { ALEX, installAccountHarness } from '../../test/accountHarness';
import { mountProfile, unlock } from '../../test/profileKit';

describe('ProfileScreen content', () => {
    const h = installAccountHarness();

    const cards = () => within(screen.getByRole('list', { name: 'Achievements' })).getAllByRole('listitem');
    const cardNames = () => cards().map(card => card.querySelector('b')?.textContent);
    const chip = (name: string) => within(screen.getByRole('group', { name: 'Achievement categories' })).getByRole('button', { name });

    it('lists all 17 achievements under All', async () => {
        await mountProfile(h);
        expect(ACHIEVEMENTS).toHaveLength(17);
        expect(cards()).toHaveLength(17);
        expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    });

    it('filters by category: Special is exactly Veteran and Perfectionist, All brings everything back', async () => {
        await mountProfile(h);
        fireEvent.click(chip('Special'));
        expect(cardNames().sort()).toEqual(['Perfectionist', 'Veteran']);
        expect(chip('Special')).toHaveAttribute('aria-pressed', 'true');
        expect(chip('All')).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(chip('Combat'));
        expect(cards()).toHaveLength(ACHIEVEMENTS.filter(a => a.category === 'combat').length);
        fireEvent.click(chip('All'));
        expect(cards()).toHaveLength(17);
    });

    it('shows a locked card with its progress, an unlocked card with its reward', async () => {
        achievementManager.updateProgress('executioner', 32);
        unlock('first_blood');
        await mountProfile(h);

        const locked = screen.getByText('Executioner').closest('li') as HTMLElement;
        expect(within(locked).getByText('32 / 100')).toBeInTheDocument();
        expect(within(locked).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '32');
        expect(within(locked).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');

        const open = screen.getByText('First Blood').closest('li') as HTMLElement;
        expect(within(open).getByText(/\+10 XP/)).toBeInTheDocument();
        expect(within(open).queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows the time achievements in hours and seconds, not raw seconds', async () => {
        achievementManager.updateProgress('veteran', 7500);
        achievementManager.updateProgress('king_of_hill', 123);
        await mountProfile(h);

        const veteran = screen.getByText('Veteran').closest('li') as HTMLElement;
        expect(within(veteran).getByText('2 / 10 h')).toBeInTheDocument();
        expect(within(veteran).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '2 / 10 h');
        const king = screen.getByText('King of the Hill').closest('li') as HTMLElement;
        expect(within(king).getByText('123 / 500 s')).toBeInTheDocument();
    });

    it('colours the border by rarity and greys what is locked', async () => {
        unlock('first_blood');
        await mountProfile(h);
        const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
        expect(card('First Blood').className).toContain('border-bay-edge'); // common
        expect(card('Slayer').className).toContain('border-[#3D7BD9]'); // rare
        expect(card('Executioner').className).toContain('border-[#A35BE0]'); // epic
        expect(card('Perfectionist').className).toContain('border-bay-hazard'); // legendary
        expect(card('Slayer').className).toContain('grayscale');
        expect(card('First Blood').className).not.toContain('grayscale');
    });

    it('shows the title of the unlocked achievement with the highest XP', async () => {
        unlock('first_blood', 'veteran', 'survivor'); // Veteran 500 XP beats Survivor 400 XP
        await mountProfile(h);
        expect(screen.getByText('Title: Veteran')).toBeInTheDocument();
    });

    it('shows Veteran when only Veteran and lower-XP achievements are unlocked', async () => {
        unlock('first_blood', 'slayer', 'veteran');
        await mountProfile(h);
        expect(screen.getByText('Title: Veteran')).toBeInTheDocument();
    });

    it('hides the title while no unlocked achievement has one', async () => {
        unlock('first_blood', 'slayer');
        await mountProfile(h);
        expect(screen.queryByText(/^Title:/)).not.toBeInTheDocument();
    });

    it('shows the fighter level, the unlocked count and the achievement XP', async () => {
        unlock('first_blood', 'killer'); // 10 + 50 XP
        h.store.fighterXp = '120';
        await mountProfile(h);
        expect(screen.getByText('Level 3 · 30 XP to the next part')).toBeInTheDocument();
        expect(screen.getByText('2/17').previousElementSibling).toHaveTextContent('Achievements');
        expect(screen.getByText('60').previousElementSibling).toHaveTextContent('Achievement XP');
    });

    it("shows the guest's current name and goes back to where it was opened from", async () => {
        const { onBack, setGuestName } = await mountProfile(h, null);
        setGuestName('Zed');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Zed');
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('reads the achievements, XP and name again after a login', async () => {
        h.api.fetchSnapshot.mockResolvedValue({
            achievements: { veteran: { progress: 1, unlocked: true, unlockedAt: 5 } }, xp: 400, look: null,
        });
        const { account } = await mountProfile(h);
        expect(screen.getByText('0/17')).toBeInTheDocument();
        expect(screen.queryByText(/^Title:/)).not.toBeInTheDocument();

        h.api.logIn.mockResolvedValue(ALEX);
        await act(async () => { await account().logIn('Alex', 'secret1'); });
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alex');
        expect(screen.getByText('1/17')).toBeInTheDocument();
        expect(screen.getByText('Title: Veteran')).toBeInTheDocument();
        expect(screen.getByText('Level 9 · 50 XP to the next part')).toBeInTheDocument();
    });
});
