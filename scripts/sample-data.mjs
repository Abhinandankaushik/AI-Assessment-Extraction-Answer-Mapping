/**
 * Question paper authored to match the real scanned CBSE answer sheet that
 * ships as the sample. Questions 1-27 correspond to answers the student
 * actually wrote; 22(b), 24(a) and 28-33 are deliberately left unattempted so
 * the app's unanswered handling is visible in the demo.
 */
export const SECTIONS = [
  {
    title: "SECTION A",
    note: "Questions 1 to 20 carry 1 mark each. Questions 17 to 20 are Assertion-Reason type.",
    questions: [
      { n: "1", marks: 1, text: "Hard water contains dissolved salts of which of the following pairs of metals?\n(A) Sodium and Potassium    (B) Calcium and Magnesium    (C) Iron and Copper    (D) Zinc and Aluminium" },
      { n: "2", marks: 1, text: "Which of the following correctly represents the formation of magnesium oxide by transfer of electrons?\n(A) Mg + O -> Mg2+ [O]2-    (B) Mg + O -> Mg- [O]+    (C) Mg2+ + O2- -> MgO2    (D) Mg + O2 -> MgO2" },
      { n: "3", marks: 1, text: "An ionic solid is found to have an unusually low melting point. Which statement best explains this observation?\n(A) It has a covalent lattice    (B) It contains free electrons    (C) It has weak electrostatic forces of attraction between its oppositely charged ions    (D) It sublimes on heating" },
      { n: "4", marks: 1, text: "What is observed when dilute hydrochloric acid is added to sodium hydroxide solution?\n(A) Salt and water is formed    (B) Hydrogen gas is evolved    (C) A white precipitate is formed    (D) No reaction takes place" },
      { n: "5", marks: 1, text: "How many electrons are present in the outermost shell of a nitrogen atom?\n(A) 3    (B) 5    (C) 7    (D) 8" },
      { n: "6", marks: 1, text: "Which of the following pairs consists only of metal oxides?\n(A) CO2 and SO2    (B) Al2O3 and MgO    (C) NO2 and CaO    (D) SO3 and Na2O" },
      { n: "7", marks: 1, text: "The ratio by mass of hydrogen to oxygen in a molecule of water is:\n(A) 1 : 1    (B) 2 : 1    (C) 1 : 16    (D) 1 : 8" },
      { n: "8", marks: 1, text: "Lactic acid is produced during anaerobic respiration in:\n(A) Mitochondria and yeast cells    (B) Cytoplasm and yeast cells    (C) Mitochondria and muscle cells    (D) Cytoplasm and oxygen deficient muscle cells" },
      { n: "9", marks: 1, text: "A pure round-yellow seeded pea plant (RRYY) is crossed with a pure wrinkled-green seeded plant (rryy). The F1 generation will be:\n(A) 50% round and yellow    (B) 75% round and yellow    (C) 100% round and yellow    (D) 25% wrinkled and green" },
      { n: "10", marks: 1, text: "Consider the following statements about the human eye:\n(i) The cornea does most of the refraction of light entering the eye.\n(ii) The iris changes the focal length of the eye lens.\n(iii) The ciliary muscles change the curvature of the eye lens.\n(iv) The retina secretes aqueous humour.\nWhich of the statements are correct?\n(A) (i) and (ii)    (B) (ii) and (iv)    (C) (i) and (iii)    (D) (iii) and (iv)" },
      { n: "11", marks: 1, text: "Which plant hormone promotes cell elongation and is responsible for phototropism?\n(A) Abscisic acid    (B) Cytokinins    (C) Gibberellins    (D) Auxins" },
      { n: "12", marks: 1, text: "Salivary amylase present in human saliva breaks down:\n(A) Proteins into amino acids    (B) Fats into fatty acids    (C) Starch into simple sugars    (D) Cellulose into glucose" },
      { n: "13", marks: 1, text: "Approximately what percentage of the water absorbed by the roots of a plant is lost through transpiration?\n(A) 25%    (B) 50%    (C) 75%    (D) 99%" },
      { n: "14", marks: 1, text: "Consider the following statements about electric circuits:\n(i) Resistance decreases when the length of a wire is increased.\n(ii) Resistance decreases when the area of cross-section is increased.\n(iii) An ammeter is connected in parallel in a circuit.\n(iv) A voltmeter is connected in parallel across a component.\nWhich of the statements are correct?\n(A) (i) and (ii)    (B) (i) and (iii)    (C) (ii) and (iii)    (D) (ii) and (iv)" },
      { n: "15", marks: 1, text: "The blue colour of the clear sky is due to:\n(A) Scattering of light    (B) Total internal reflection    (C) Dispersion of light    (D) Refraction of light" },
      { n: "16", marks: 1, text: "Consider the following statements about a food chain:\n(i) Only about 10% of the energy is transferred to the next trophic level.\n(ii) Producers always occupy the first trophic level.\n(iii) Energy flow in an ecosystem is cyclic.\n(iv) Decomposers occupy the first trophic level.\nWhich of the statements are correct?\n(A) (i) and (ii)    (B) (ii) and (iii)    (C) (iii) and (iv)    (D) (i) and (iv)" },
      { n: "17", marks: 1, text: "Assertion (A): Copper vessels lose their shine and acquire a green coating over time.\nReason (R): Copper reacts with moist carbon dioxide present in air.\n(A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).\n(B) Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A).\n(C) Assertion (A) is true, but Reason (R) is false.\n(D) Assertion (A) is false, but Reason (R) is true." },
      { n: "18", marks: 1, text: "Assertion (A): The heart of a fish has only two chambers.\nReason (R): Blood in a fish is oxygenated in the gills and is sent directly to the rest of the body, so oxygenated and deoxygenated blood need not be separated in the heart.\n(A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).\n(B) Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A).\n(C) Assertion (A) is true, but Reason (R) is false.\n(D) Assertion (A) is false, but Reason (R) is true." },
      { n: "19", marks: 1, text: "Assertion (A): A concave mirror is used as a shaving mirror.\nReason (R): A concave mirror always forms a real and inverted image.\n(A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).\n(B) Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A).\n(C) Assertion (A) is true, but Reason (R) is false.\n(D) Assertion (A) is false, but Reason (R) is true." },
      { n: "20", marks: 1, text: "Assertion (A): Rainwater harvesting is an important method of water conservation.\nReason (R): Groundwater does not evaporate and does not promote the breeding of mosquitoes.\n(A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).\n(B) Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of Assertion (A).\n(C) Assertion (A) is true, but Reason (R) is false.\n(D) Assertion (A) is false, but Reason (R) is true." }
    ]
  },
  {
    title: "SECTION B",
    note: "Questions 21 to 26 carry 2 marks each.",
    questions: [
      { n: "21", marks: 2, text: "An object is placed 10 cm in front of a concave mirror of focal length 15 cm. Using the mirror formula, find the position of the image formed." },
      { n: "22 (a)", marks: 2, text: "Lamp A is rated 50 W, 220 V and Lamp B is rated 25 W, 220 V. Calculate the ratio of their resistances RA : RB." },
      { n: "22 (b)", marks: 2, text: "If Lamp A and Lamp B are now connected in series across a 220 V supply, which lamp will glow brighter? Give a reason for your answer." },
      { n: "23", marks: 2, text: "Describe, with the help of a labelled diagram, how reproduction takes place in Hydra." },
      { n: "24 (a)", marks: 2, text: "State any two structural differences between arteries and veins." },
      { n: "24 (b)", marks: 2, text: "(i) Why is the transport system in plants relatively slower than that in animals?\n(ii) Describe the composition and the function of phloem tissue." },
      { n: "25", marks: 2, text: "When zinc granules are added to dilute sulphuric acid, state any two observations which indicate that a chemical change has taken place. Support your answer with the chemical equation involved." },
      { n: "26", marks: 2, text: "Write balanced chemical equations for the following reactions:\n(a) Nitric acid reacts with calcium hydroxide.\n(b) Sodium chloride solution reacts with silver nitrate solution." }
    ]
  },
  {
    title: "SECTION C",
    note: "Questions 27 to 33 carry 3 marks each.",
    questions: [
      { n: "27 (a)", marks: 1, text: "Define 1 volt. Express it in terms of the work done and the charge moved." },
      { n: "27 (b)", marks: 2, text: "A 5 ohm resistor and a 10 ohm resistor are connected in series with a 1.5 V cell and a plug key. Draw the circuit diagram and calculate the current flowing through the circuit." },
      { n: "28", marks: 3, text: "Explain why the Sun appears reddish at sunrise and at sunset, while it appears white when it is overhead at noon." },
      { n: "29", marks: 3, text: "Draw a neat diagram of a neuron and label any three of its parts. State the function of the part that receives information." },
      { n: "30", marks: 3, text: "(a) What is meant by a homologous series of carbon compounds?\n(b) Write the general formula of alkanes and name the first two members of the series." },
      { n: "31", marks: 3, text: "State Fleming's left-hand rule. Explain how it is used to determine the direction of the force acting on a current-carrying conductor placed in a magnetic field." },
      { n: "32", marks: 3, text: "What is biodegradable waste? Give two examples and explain why the accumulation of non-biodegradable waste is harmful to the environment." },
      { n: "33", marks: 3, text: "Explain the process of double circulation in human beings and state why it is necessary." }
    ]
  }
];

export const QUESTIONS = SECTIONS.flatMap((section) => section.questions);
