import {genkit, registerHelper} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

registerHelper('JSON_stringify', (context: any) => {
  return JSON.stringify(context);
});

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
