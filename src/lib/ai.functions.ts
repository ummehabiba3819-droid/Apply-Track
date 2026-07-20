import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a career-writing assistant inside ApplyTrack, an app that helps job seekers manage applications. Your one job is to write a tailored cover letter for a specific job application.

You will be given:
1. The candidate's background (their own words — skills, experience, projects, education)
2. The job description they are applying to
3. The company name and role title

Rules you must follow:
- Write 200-300 words, in plain paragraph form (no headers, no bullet points, no markdown, no placeholders like "[Your Name]").
- Open by referencing something specific and real from the job description or company — never a generic "I am excited to apply" opener.
- Connect 2-3 specific things from the candidate's background to specific requirements or responsibilities mentioned in the job description. Be concrete, not vague.
- NEVER invent skills, experience, projects, or qualifications the candidate did not mention in their background. If their background is thin for this role, work honestly with what's there rather than fabricating.
- Avoid cliches and empty phrases such as "I am a hard worker," "team player," "perfect fit," "passionate about," used without specific evidence backing them up.
- Write in first person, as the candidate, in a natural and confident tone — not stiff or overly formal.
- End with a short, direct closing line (no "Sincerely, [Name]" signature block needed).

Output ONLY the cover letter body text. No preamble, no explanation, no quotation marks around it.`;

const Input = z.object({ applicationId: z.string().uuid() });

export const generateCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: app, error: appErr }, { data: profile }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.applicationId).maybeSingle(),
      supabase.from("profiles").select("bio").eq("user_id", userId).maybeSingle(),
    ]);
    if (appErr || !app) throw new Error("Application not found");
    const bio = profile?.bio?.trim();
    if (!bio) throw new Error("Add your background on the Profile page first.");

    const userMessage = `Candidate background:
${bio}

Company: ${app.company}
Role: ${app.role}

Job description:
${app.job_description || "(No job description provided)"}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from AI");

    const { error: upErr } = await supabase
      .from("applications")
      .update({ cover_letter: text })
      .eq("id", data.applicationId);
    if (upErr) throw upErr;

    return { coverLetter: text };
  });
