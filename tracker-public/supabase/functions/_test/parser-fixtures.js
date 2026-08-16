/* Fixtures for the paste-to-create parser.
 *
 * Each entry is a job description as it actually arrives on the clipboard —
 * page furniture included, because that furniture is what the parser has to
 * survive. `expect` holds the value a human would have typed; null means the
 * field genuinely is not recoverable from the text and the parser is expected
 * to admit that rather than guess.
 *
 * Adding a fixture is the whole maintenance story for these heuristics: paste
 * a real posting, write down what it should produce, run parser-suite.js.
 */

module.exports = [
  {
    name: "structured posting with explicit labels",
    text: `Job Title: Data Analyst
Company: Northwind Trading Ltd
Location: London, UK
Salary: £45,000 – £55,000
Contract: Permanent, full-time

About the role
We are looking for a Data Analyst to join our commercial team. You will own
the weekly sales reporting pack and support the pricing group with ad-hoc
analysis.`,
    expect: {
      role: "Data Analyst",
      company: "Northwind Trading Ltd",
      location: "London",
      contactEmail: null,
    },
  },

  {
    name: "Greenhouse posting pasted whole, nav and footer included",
    text: `Skip to content
View all jobs
Senior Backend Engineer
Acme Robotics
Berlin, Germany · Engineering · Full-time
Apply for this job
Resume/CV
Attach
Dropbox
Google Drive
Enter manually
Cover Letter
About Acme Robotics
Acme Robotics builds autonomous warehouse systems for European distribution
centres. We are forty people, profitable, and shipping to eleven countries.
What you'll do
Own the ingestion pipeline that moves telemetry off the robots and into our
analytics stack.
Powered by Greenhouse`,
    expect: {
      role: "Senior Backend Engineer",
      company: "Acme Robotics",
      location: "Berlin",
      contactEmail: null,
    },
  },

  {
    name: "LinkedIn posting pasted whole, with page furniture",
    text: `Skip to main content
LinkedIn
Sign in
Join now
Investment Analyst
Bloomberg · London, United Kingdom
Hybrid
3 weeks ago · 47 applicants
Easy Apply
Save
Show more
Seniority level
Mid-Senior level
Employment type
Full-time
About the job
Bloomberg is looking for an Investment Analyst to join the EMEA equities desk.
You will produce sector notes and maintain the coverage models.
Report this job`,
    expect: {
      role: "Investment Analyst",
      company: "Bloomberg",
      location: "London (Hybrid)",
      contactEmail: null,
    },
  },

  {
    name: "prose-heavy description with no labels at all",
    text: `We are a fast-growing renewable energy consultancy based in Bristol, and we are looking for a Sustainability Consultant to support our advisory practice. You will work alongside our engineering team on feasibility studies for onshore wind and community solar, and you will spend roughly a third of your time on client sites across the south west.`,
    expect: {
      role: "Sustainability Consultant",
      company: null,
      location: "Bristol",
      contactEmail: null,
    },
  },

  {
    name: "company named only in the first line, role second",
    text: `Meridian Capital
Equity Research Associate
Full-time · Milan
Join a team of twelve analysts covering European industrials. The desk
publishes initiation notes and maintains models on thirty listed names.`,
    expect: {
      role: "Equity Research Associate",
      company: "Meridian Capital",
      location: "Milan",
      contactEmail: null,
    },
  },

  {
    name: "remote posting with no city named",
    text: `Position: Technical Writer
Company: Halyard Systems

We are fully remote. Our team spans eight countries and we have never had an
office. You will own the developer documentation for our API and SDKs.`,
    expect: {
      role: "Technical Writer",
      company: "Halyard Systems",
      location: "Remote",
      contactEmail: null,
    },
  },

  {
    name: "hybrid posting naming two locations",
    text: `Product Manager, Payments
Stripe
Hybrid — Dublin or Amsterdam
You will own the disputes surface end to end, working with a team of six
engineers and a designer.`,
    expect: {
      role: "Product Manager, Payments",
      company: "Stripe",
      location: "Dublin / Amsterdam",
      contactEmail: null,
    },
  },

  {
    name: "posting containing an application email address",
    text: `Marketing Assistant
Brightwater Media
Based in Leeds.

We need someone to run our client newsletters and keep the content calendar
honest. Agency experience helps but is not required.

To apply, send your CV to careers@brightwatermedia.co.uk by 30 September.
Please do not reply to noreply@mailer.brightwatermedia.co.uk.`,
    expect: {
      role: "Marketing Assistant",
      company: "Brightwater Media",
      location: "Leeds",
      contactEmail: "careers@brightwatermedia.co.uk",
    },
  },

  {
    name: "Italian posting with labels and an application address",
    text: `Analista Finanziario Junior
Banca Sella S.p.A.
Sede: Biella, Italia
Contratto: tempo determinato 12 mesi

Cerchiamo un Analista Finanziario Junior da inserire nel team di controllo di
gestione. Il candidato si occuperà di reportistica mensile e analisi degli
scostamenti.

Per candidarsi inviare il CV a selezioni@bancasella.it`,
    expect: {
      role: "Analista Finanziario Junior",
      company: "Banca Sella S.p.A.",
      location: "Biella",
      contactEmail: "selezioni@bancasella.it",
    },
  },

  {
    name: "short informal posting, three lines, no structure",
    text: `Barista wanted
The Daily Grind, Shoreditch
Drop in with a CV or email hello@dailygrind.co.uk`,
    expect: {
      role: "Barista wanted",
      company: "The Daily Grind, Shoreditch",
      location: null,
      contactEmail: "hello@dailygrind.co.uk",
    },
  },

  {
    name: "posting with a source URL in the paste",
    text: `Data Engineer at Zalando
Berlin
https://boards.greenhouse.io/zalando/jobs/4820117
We are rebuilding the event pipeline that powers personalisation.`,
    expect: {
      role: "Data Engineer",
      company: "Zalando",
      location: "Berlin",
      contactEmail: null,
      sourceUrl: "https://boards.greenhouse.io/zalando/jobs/4820117",
    },
  },

  /* ---- robustness: these must return nulls, never throw ---------------- */

  {
    name: "empty input",
    text: "",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "whitespace only",
    text: "   \n\n\t  \n ",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "punctuation and symbols only",
    text: "••• ——— ||| ### $$$ %%% \\\\ /// {{{ }}} [[[ ]]]",
    expect: { role: null, company: null, location: null, contactEmail: null },
    robustness: true,
  },
  {
    name: "non-Latin script",
    text: `データアナリスト
株式会社サンプル
東京都渋谷区`,
    expect: { location: null, contactEmail: null },
    robustness: true,
    /* Role and company are deliberately unasserted: the structural rules will
       return the first two lines at low confidence, which is the honest
       answer for a script this parser has no vocabulary for. What matters is
       that it does not throw and does not claim confidence. */
  },

  /* ---- holdout ---------------------------------------------------------
     Written after the parser was already passing everything above, and
     scored separately. The tuned set measures whether the rules do what they
     were built to do; only this set says anything about a posting the parser
     has never seen. Do not tune against these — add new fixtures above
     instead, and let this number move on its own. */

  {
    name: "holdout: Lever posting with a bulleted header",
    holdout: true,
    text: `Careers
Senior Compliance Officer
Revolut · London, UK
Full time
Apply for this job
We're looking for a Senior Compliance Officer to join our financial crime team.
You will own the transaction monitoring rulebook.`,
    expect: { role: "Senior Compliance Officer", company: "Revolut", location: "London" },
  },
  {
    name: "holdout: location on the first line",
    holdout: true,
    text: `Manchester, UK
Junior Software Developer
Codeworks Digital
£28,000 per annum
Permanent, hybrid working`,
    expect: { role: "Junior Software Developer", company: "Codeworks Digital", location: "Manchester (Hybrid)" },
  },
  {
    name: "holdout: Italian posting in capitals with a labelled site",
    holdout: true,
    text: `ACCOUNT MANAGER
FERRERO S.P.A.
Sede di lavoro: Alba (CN)
Contratto a tempo indeterminato
Inviare candidatura a hr@ferrero.com`,
    expect: {
      role: "ACCOUNT MANAGER", company: "FERRERO S.P.A.",
      location: "Alba (CN)", contactEmail: "hr@ferrero.com",
    },
  },
  {
    name: "holdout: public sector posting with a reference number",
    holdout: true,
    text: `Research Assistant (Ref: RA-2291)
University of Edinburgh
School of Informatics
Grade UE06
Closing date: 12 September 2026`,
    expect: { role: "Research Assistant", company: "University of Edinburgh", location: "Edinburgh" },
  },
  {
    name: "holdout: a noreply address before the real one",
    holdout: true,
    text: `Customer Success Manager
Zeta Analytics
Remote (UK)
This message was sent from noreply@zetaanalytics.io
Questions? Write to talent@zetaanalytics.io`,
    expect: {
      role: "Customer Success Manager", company: "Zeta Analytics",
      location: "Remote", contactEmail: "talent@zetaanalytics.io",
    },
  },
  {
    name: "holdout: Indeed listing with salary and posting age",
    holdout: true,
    text: `Indeed
Warehouse Operative - Night Shift
Kuehne+Nagel
Milton Keynes
£13.50 an hour
Posted 4 days ago
Easy apply
Full job description
We are recruiting Warehouse Operatives for our night shift operation.`,
    expect: {
      role: "Warehouse Operative - Night Shift", company: "Kuehne+Nagel",
      location: null, contactEmail: null,
    },
  },
  {
    name: "holdout: recruiter advert that never names the employer",
    holdout: true,
    text: `Our client, a leading asset manager, is looking for a Portfolio Analyst.
Location: London (hybrid, 3 days in office)
Salary: competitive
Contact: james.hall@apexrecruit.co.uk`,
    expect: {
      role: "Portfolio Analyst", company: null,
      location: "London (Hybrid)", contactEmail: "james.hall@apexrecruit.co.uk",
    },
  },
  {
    name: "holdout: two cities on a labelled line, with a source URL",
    holdout: true,
    text: `Data Protection Officer
Vodafone
Location: Milan / Rome
Apply via https://careers.vodafone.com/job/12345`,
    expect: {
      role: "Data Protection Officer", company: "Vodafone",
      location: "Milan / Rome",
      sourceUrl: "https://careers.vodafone.com/job/12345",
    },
  },
];
