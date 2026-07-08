// Parental-control content categories — distinct from the 40 AI-security threats. Tier-1
// keyword heuristics (a real deployment would use a local classifier). Applied to content
// both shared (outgoing) and received (AI response). Enforced when the admin enables it.
// Each category carries an English pattern + a Hebrew keyword pack (Hebrew has no \b word
// boundary, so Hebrew terms match as substrings, catching prefixed forms like ה/ו/ל/ב).
export const CONTENT_RULES = [
  {
    id: "profanity",
    label: "Profanity",
    severity: "moderate",
    description: "Swearing or crude language in content shared with or returned by the AI.",
    patterns: [/\b(f+u+c+k\w*|sh[i1]t\w*|bitch|asshole|bastard|dick(head)?)\b/i, /(חרא|מניאק|בן ?זונה|זונה|תזדיין|מזדיין|שמוק|מטומטם|אידיוט|מפגר|דביל|טמבל)/]
  },
  {
    id: "sexual",
    label: "Sexual / explicit",
    severity: "high",
    description: "Sexual, pornographic, or sexually explicit material (prompt and AI response).",
    patterns: [/\b(porn(ography)?|xxx|nudes?|sex ?tape|explicit sexual|nsfw|onlyfans|sexting|send nudes|dick ?pic)\b/i, /(פורנו|פורנוגרפ|תמונות עירום|עירום מלא|סקס|זיון|אורגזמה|חשפנ|סקסטינג)/]
  },
  {
    id: "violence",
    label: "Violence / weapons",
    severity: "high",
    description: "Graphic violence, gore, or instructions for weapons or attacks.",
    patterns: [/\b(behead|massacre|mutilate|how to (kill|murder)|(make|build) a bomb|school shooting)\b/i, /(לרצוח|רצח|לפוצץ|פצצה|אקדח|רובה|לדקור|טבח|פיגוע|חומר נפץ|ירי בבית ספר)/]
  },
  {
    id: "self-harm",
    label: "Self-harm",
    severity: "high",
    description: "Content that encourages or describes self-harm or suicide.",
    patterns: [/\b(suicide|kill myself|self[- ]harm|end my life|how to die)\b/i, /(להתאבד|התאבדות|לפגוע בעצמי|פגיעה עצמית|לשים קץ לחיי|איך למות|רוצה למות|אובדני)/]
  },
  {
    id: "hate",
    label: "Hate / extremism",
    severity: "high",
    description: "Hateful, discriminatory, or extremist content targeting a group.",
    patterns: [/\b(ethnic cleansing|genocide|hate speech|white supremacy)\b/i, /(טיהור אתני|רצח עם|שיח שנאה|עליונות לבנה|גזענות|נאצי|אנטישמיות)/]
  },
  {
    id: "drugs",
    label: "Drugs / alcohol / vaping",
    severity: "moderate",
    description: "Illicit drugs, plus underage alcohol, vaping, or nicotine.",
    patterns: [/\b(cocaine|heroin|meth(amphetamine)?|how to (make|cook) (drugs|meth)|buy drugs|vap(e|ing)|juul|e-?cig(arette)?|nicotine|get drunk|buy (alcohol|weed|vape)|fake id)\b/i, /(סמים|קוקאין|הרואין|קנאביס|מריחואנה|אקסטזי|לקנות סמים|איך להכין סמים|קריסטל|אלכוהול|להשתכר|וייפ|סיגריה אלקטרונית|ניקוטין|לקנות אלכוהול)/]
  },
  {
    id: "eating-disorder",
    label: "Eating disorders",
    severity: "high",
    description: "Pro-anorexia/bulimia content, purging, or unsafe extreme dieting.",
    patterns: [/\b(pro[- ]?ana|pro[- ]?mia|thinspo|thinspiration|how to purge|make myself throw up|starv(e|ing) myself|stop eating to lose|laxative diet)\b/i, /(אנורקסיה|בולימיה|להקיא את האוכל|להרעיב את עצמי|הפרעת אכילה|לרזות מהר|פרו אנה)/]
  },
  {
    id: "harassment",
    label: "Bullying / harassment",
    severity: "high",
    description: "Cyberbullying, threats, or harassing language — as target or author.",
    patterns: [/\b(kill yourself|kys|go die|nobody likes you|everyone hates you|you('re| are) (worthless|a loser|ugly|pathetic))\b/i, /(לך תמות|תהרוג את עצמך|אף אחד לא אוהב אותך|כולם שונאים אותך|את מכוערת|אתה מכוער|לוזר|חתיכת כושל)/]
  },
  {
    id: "grooming",
    label: "Grooming / predatory",
    severity: "high",
    description: "Predatory grooming patterns: secrecy, requests for photos, meeting up alone.",
    patterns: [/\b(don'?t tell your (parents|mom|dad)|our (little )?secret|send me a (pic|photo|nude)|are you (home )?alone|how old are you really|let'?s meet (up|in person)|what are you wearing)\b/i, /(אל תספר להורים|זה הסוד שלנו|שלח לי תמונה שלך|אתה לבד בבית|בת כמה את באמת|בוא ניפגש לבד|מה את לובשת)/]
  }
];
