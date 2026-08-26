// Mirrors the question set shown in the Figma reference so the sample run
// looks like the design. Sub-parts are intentionally present.
export const QUESTIONS = [
  { n: "1", marks: 2, text: "Which blood vessel carries blood away from the heart?" },
  { n: "2", marks: 2, text: "Which of the following organelles is primarily involved in photosynthesis?" },
  { n: "3", marks: 2, text: "Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process." },
  { n: "4", marks: 2, text: "Describe the flow of blood through the human heart starting from the right atrium and ending at the aorta; include the names of valves crossed." },
  { n: "5", marks: 2, text: "Draw a labelled diagram of an alveolus showing capillaries and air space (label alveolar sac, capillary, and direction of gas exchange)." },
  { n: "6", marks: 5, text: "Draw a neat labelled diagram of the human digestive system (stomach, small intestine, large intestine, liver, pancreas) and label the site where most absorption occurs." },
  { n: "7", marks: 5, text: "Draw and label a nephron (Bowman's capsule, glomerulus, proximal tubule, loop of Henle, distal tubule, collecting duct)." },
  { n: "8", marks: 5, text: "Explain the structural differences between palisade mesophyll and spongy mesophyll and state how each structure aids its function in the leaf." },
  { n: "9", marks: 5, text: "Describe the process of transpiration in plants in two to three sentences and name two environmental factors that increase its rate." },
  { n: "10", marks: 5, text: "Explain how the structure of xylem vessels facilitates water transport in plants (mention one structural feature and its role)." },
  { n: "11 (a)", marks: 2, text: "A diagram shows two potted plants - Plant A in bright light with broad green leaves, Plant B kept in dim light with pale, elongated leaves. State which plant is healthier and give one reason." },
  { n: "11 (b)", marks: 3, text: "Suggest one practical measure to help Plant B recover." },
  { n: "12 (a)", marks: 5, text: "A resting person has a tidal volume (air per breath) of 0.5 L and breathes 12 times per minute. Calculate the pulmonary ventilation per minute." },
  { n: "12 (b)", marks: 5, text: "If dead space is 0.15 L per breath, calculate the alveolar ventilation per minute. Show working." },
];

// Deliberately out of printed order, with gaps, a multi-page answer and one
// answer that matches no question at all.
export const ANSWERS = [
  { label: "Q2.", lines: [
    "The process mainly occurs in the chloroplast of the plant",
    "cell. It has two main stages:",
    "1. Light reaction - Captures light energy.",
    "2. Dark reaction - Uses energy to make glucose.",
  ] },
  { label: "Q1.", lines: [
    "The artery carries blood away from the heart.",
    "The aorta is the largest artery in the body.",
  ] },
  { label: "Q5.", lines: [
    "The alveolus is a tiny air sac surrounded by capillaries.",
    "Oxygen diffuses from the alveolar sac into the blood and",
    "carbon dioxide diffuses out. (diagram drawn alongside)",
  ] },
  { label: "Q3.", lines: [
    "Chloroplasts contain chlorophyll a and chlorophyll b, the",
    "main pigments. Photosynthesis has two stages - the light",
    "dependent reaction in the thylakoid and the Calvin cycle",
    "in the stroma.",
  ] },
  { label: "Q7.", spans: true, lines: [
    "A nephron is the functional unit of the kidney. Blood enters",
    "through the glomerulus which sits inside Bowman's capsule.",
    "Filtration happens here and the filtrate passes into the",
    "proximal convoluted tubule where most reabsorption occurs.",
    "It then travels down the loop of Henle, which concentrates",
    "the filtrate, and into the distal convoluted tubule before",
    "finally reaching the collecting duct.",
  ] },
  { label: "Q8.", lines: [
    "Palisade mesophyll cells are long and packed tightly near",
    "the upper surface with many chloroplasts, so they absorb",
    "the most light. Spongy mesophyll cells are round and loosely",
    "packed with air spaces between them, which helps gases",
    "diffuse in and out of the leaf.",
  ] },
  { label: "Q11 (b).", lines: [
    "Move Plant B to a bright window so it gets sunlight.",
  ] },
  { label: "Q12 (b).", lines: [
    "Alveolar volume = 0.5 - 0.15 = 0.35 L per breath",
    "Alveolar ventilation = 0.35 x 12 = 4.2 L per minute",
  ] },
  // No matching question exists for this one - tests orphan handling.
  { label: "Q15.", lines: [
    "Newton's third law states that every action has an equal",
    "and opposite reaction.",
  ] },
];
