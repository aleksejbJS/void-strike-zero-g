// Local inspection entry; it does not alter the player's saved appearance or match state.
import '../styles/atompunk-fonts.css';
import './rigDemo.css';
import { mountRigWorld } from './rigWorld';
import type { RigDemoMode } from './rigWorld';

export const mountRigDemo = async (): Promise<void> => {
    const host = document.getElementById('rig-demo');
    if (!host) throw new Error('Character rig inspection host is missing');
    const modes: [RigDemoMode, string][] = [
        ['source', 'Исходная поза'], ['idle', 'Стоять'], ['run', 'Бежать'], ['jump', 'Прыгать'],
        ['fly', 'Джетпак'], ['crouch', 'Присесть'], ['prone', 'Лечь'], ['hurt', 'Ранение'],
        ['fall-body', 'Ragdoll'], ['gib', 'Разрыв'], ['cut', 'Половины'], ['limb', 'Отрыв ноги'],
    ];
    host.innerHTML = `<main><header><img src="/assets/menu/void-strike-logo.webp" alt="Void Strike" />
        <h1>Проверка движения персонажей</h1></header><p>Пять образов на общем скелете и физике игры.</p>
        <div class="rig-controls">${modes.map(([id, name]) => `<button data-mode="${id}" aria-pressed="${id === 'source'}">${name}</button>`).join('')}
        <button id="rig-face">Развернуть</button><button id="rig-pause">Пауза</button><a href="/">В игру</a></div>
        <p id="rig-status" role="status">Загрузка рисунков…</p><div class="rig-stage" id="rig-stage"></div>
        <div class="rig-names"><span>Человек</span><span>Девушка</span><span>Робот</span><span>Toxic</span><span>Кот</span></div></main>`;
    const humanOnly = new URLSearchParams(window.location.search).get('body') === 'human';
    if (humanOnly) {
        const title = host.querySelector('h1');
        const intro = host.querySelector('main > p');
        if (title) title.textContent = 'Human — ракурсы и повреждения';
        if (intro) intro.textContent = 'Проверочный набор: присед, положение лёжа, ранение и смерть.';
        const names = host.querySelector<HTMLElement>('.rig-names');
        if (names) { names.textContent = 'Human — новые ракурсы и состояния'; names.style.gridTemplateColumns = '1fr'; }
    }
    const stage = document.getElementById('rig-stage');
    const status = document.getElementById('rig-status');
    if (!stage || !status) throw new Error('Character rig controls are incomplete');
    const world = await mountRigWorld(stage);
    status.textContent = 'Рисунки загружены. Дорисованные детали подключены к движению, падениям и разрывам.';
    for (const button of host.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
        button.onclick = () => {
            world.mode(button.dataset.mode as RigDemoMode);
            for (const other of host.querySelectorAll('[data-mode]')) other.setAttribute('aria-pressed', String(other === button));
        };
    }
    document.getElementById('rig-face')?.addEventListener('click', world.turn);
    document.getElementById('rig-pause')?.addEventListener('click', event => {
        const paused = world.pause();
        (event.currentTarget as HTMLButtonElement).textContent = paused ? 'Продолжить' : 'Пауза';
    });
    if (humanOnly) host.querySelector<HTMLButtonElement>('[data-mode="prone"]')?.click();
    window.addEventListener('pagehide', world.destroy, { once: true });
};

mountRigDemo().catch(error => {
    console.error('Character rig inspection failed:', error);
    const status = document.getElementById('rig-status') ?? document.getElementById('rig-demo');
    if (status) status.textContent = 'Не удалось загрузить проверку персонажей. Подробности — в консоли.';
});
