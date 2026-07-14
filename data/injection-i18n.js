// Multilingual prompt-injection / jailbreak signatures. The core injection intent — "ignore the
// previous instructions" and "reveal the system prompt" — expressed across ~29 languages, so the
// on-device review inspects non-English prompts too (parity with inline gateways that scan in many
// languages). English + Hebrew are already covered by the base `inj-ignore` detector; this adds the
// rest. Patterns match the distinctive verb+object of each phrase, tolerant of inflection.
export const INJECTION_I18N = [
  // "ignore the previous instructions" — instruction-override, per language
  /ignora\s+(las\s+)?(instrucciones|indicaciones)\s+(anteriores|previas)/i,        // Spanish
  /ignore[rz]?\s+(les\s+)?(instructions|consignes)\s+(précédentes|antérieures)/i,   // French
  /ignoriere\s+(die\s+)?(vorherigen|vorigen|obigen)\s+(anweisungen|anordnungen)/i,  // German
  /ignora\s+(le\s+)?istruzioni\s+(precedenti|sopra)/i,                              // Italian
  /ignore\s+(as\s+)?instruções\s+(anteriores|prévias)/i,                           // Portuguese
  /negeer\s+(de\s+)?(vorige|bovenstaande)\s+(instructies|aanwijzingen)/i,           // Dutch
  /игнорир[а-яё]*\s+(предыдущие|все|вышеуказанные)\s+(инструкц|указани)[а-яё]*/i,    // Russian
  /ігнор[а-яіїєґ]*\s+(попередні|усі)\s+(інструкці|вказівк)[а-яіїєґ]*/i,              // Ukrainian
  /zignoruj\s+(poprzednie|wcześniejsze)\s+(instrukcje|polecenia)/i,                 // Polish
  /önceki\s+(tüm\s+)?(talimatları|komutları)\s+(yoksay|görmezden\s+gel)/i,          // Turkish
  /تجاهل\s+(كل\s+)?(التعليمات|الأوامر)\s+السابقة/,                                   // Arabic
  /دستور(ات|های)?\s+قبلی\s+را\s+نادیده\s+بگیر/,                                      // Persian
  /(पिछले|पूर्व)\s+निर्देश[^\s]{0,4}\s*(को\s*)?(अनदेखा|नज़रअंदाज़)/,                          // Hindi
  /忽略(之前|上面|以上|先前)的?(指令|指示|说明|提示)/,                                    // Chinese (Simplified)
  /(以前|前|上記|これまで)の(指示|指令|命令)を?\s*無視/,                                   // Japanese
  /(이전|위의|앞의)\s*(지시|명령|지침)(을|를)?\s*무시/,                                    // Korean
  /(bỏ\s+qua|phớt\s+lờ)\s+(các\s+)?hướng\s+dẫn\s+(trước|phía\s+trên)/i,             // Vietnamese
  /abaikan\s+(instruksi|arahan)\s+(sebelumnya|di\s+atas)/i,                          // Indonesian / Malay
  /(เพิกเฉย|ละเว้น|เพิกเฉยต่อ)\s*คำสั่ง(ก่อนหน้า|ด้านบน)/,                                  // Thai
  /αγνόησε\s+(τις\s+)?(προηγούμενες|παραπάνω)\s+(οδηγίες|εντολές)/i,                // Greek
  /ignor[ăa]\s+(instrucțiunile|comenzile)\s+(anterioare|precedente|de\s+mai\s+sus)/i, // Romanian
  /ignoruj\s+(předchozí|výše\s+uvedené)\s+(pokyny|instrukce)/i,                     // Czech
  /ignorera\s+(tidigare|föregående|ovanstående)\s+(instruktioner|anvisningar)/i,    // Swedish
  /ignor(er|ér)\s+(tidligere|forrige|ovenstående)\s+(instruksjoner|instruktioner)/i, // Norwegian / Danish
  /(jätä\s+huomiotta|ohita)\s+(aiemmat|edelliset|yllä\s+olevat)\s+ohjeet/i,          // Finnish
  /hagyd\s+figyelmen\s+kívül\s+(az\s+)?(előző|fenti)\s+utasításokat/i,               // Hungarian

  // "reveal / show the system prompt" — a few high-value languages (English handled by base rule)
  /(muestra|revela)\s+(tu\s+)?(prompt\s+del\s+sistema|instrucciones\s+del\s+sistema)/i, // Spanish
  /(montre|révèle)\s+(ton\s+)?(prompt|invite)\s+système/i,                          // French
  /(zeige|verrate)\s+(deinen\s+)?system[-\s]?prompt/i,                              // German
  /(显示|展示|透露)(你的)?(系统提示|系统指令|系统提示词)/,                                  // Chinese
  /システム\s*プロンプト(を)?\s*(表示|教えて|見せて)/,                                     // Japanese
];
