import { NextResponse } from 'next/server';

/**
 * Payslip photo -> gross salary (owner: E5).
 * Returns 501 until ANTHROPIC_API_KEY and PAYSLIP_MODEL are set; the app then falls back to typed-in gross.
 * Privacy: the image is not stored. Only the extracted gross is returned.
 */
export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.PAYSLIP_MODEL;
  if (!key || !model) {
    return NextResponse.json({ error: 'not_configured', hint: 'Type your gross salary instead.' }, { status: 501 });
  }
  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no image' }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer()).toString('base64');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data } },
            {
              type: 'text',
              text: 'This is a Romanian payslip (fluturas de salariu). Reply with JSON only: {"grossLei": number|null, "confidence": number between 0 and 1}. grossLei is the gross salary (salariu brut / venit brut) for the month.',
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return NextResponse.json({ error: 'reader_failed' }, { status: 502 });
  const out = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = out.content?.find((c) => c.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { grossLei: number | null; confidence: number };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'unreadable' }, { status: 422 });
  }
}
