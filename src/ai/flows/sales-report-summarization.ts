'use server';
/**
 * @fileOverview A sales report summarization AI agent.
 *
 * - summarizeSalesReport - A function that handles the sales report summarization process.
 * - SummarizeSalesReportInput - The input type for the summarizeSalesReport function.
 * - SummarizeSalesReportOutput - The return type for the summarizeSalesReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SalesDataSchema = z.object({
  total_vendido_centavos: z.number().describe('The total amount sold in cents.'),
  total_recarregado_centavos: z.number().describe('The total amount recharged in cents.'),
  vendas_por_pdv: z.array(
    z.object({
      pdv_id: z.string().describe('The ID of the point of sale.'),
      nome: z.string().describe('The name of the point of sale.'),
      total_centavos: z.number().describe('The total amount sold at this point of sale in cents.'),
    })
  ).describe('An array of sales data for each point of sale.'),
});

const SummarizeSalesReportInputSchema = z.object({
  salesData: SalesDataSchema.describe('The sales data to summarize.'),
});
export type SummarizeSalesReportInput = z.infer<typeof SummarizeSalesReportInputSchema>;

const SummarizeSalesReportOutputSchema = z.object({
  summary: z.string().describe('A summary of the sales data, including trends and insights.'),
});
export type SummarizeSalesReportOutput = z.infer<typeof SummarizeSalesReportOutputSchema>;

export async function summarizeSalesReport(input: SummarizeSalesReportInput): Promise<SummarizeSalesReportOutput> {
  return summarizeSalesReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeSalesReportPrompt',
  input: {schema: SummarizeSalesReportInputSchema},
  output: {schema: SummarizeSalesReportOutputSchema},
  prompt: `You are an expert sales data analyst. You will be provided with sales data from an event, and you will generate a report summarizing the data, identifying trends and insights.

Sales Data:
{{{jsonStringify salesData}}}

Generate a concise summary of the sales data, highlighting key trends, insights, and recommendations for optimizing resource allocation and improving the event experience.`,
  customize: (prompt, input) => {
    prompt.helpers = {
      jsonStringify: (obj: any) => JSON.stringify(obj),
    };
    return prompt;
  }
});

const summarizeSalesReportFlow = ai.defineFlow(
  {
    name: 'summarizeSalesReportFlow',
    inputSchema: SummarizeSalesReportInputSchema,
    outputSchema: SummarizeSalesReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
