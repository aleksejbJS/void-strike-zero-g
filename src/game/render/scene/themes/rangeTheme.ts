// The test range (#range): The Pit's look without its posters and background cargo,
// so nothing in the picture can be mistaken for a target and no ad is ever shown.

import { SceneTheme } from '../sceneTheme';
import { pitTheme } from './pitTheme';

export const rangeTheme = (): SceneTheme => ({
    ...pitTheme(),
    decor: [],
    adPlaces: [],
});
