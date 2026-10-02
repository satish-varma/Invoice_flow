const isMatch = (s1, s2) => {
   s1 = s1.toLowerCase().replace(/&/g, 'and').replace(/juice/g, '');
   s2 = s2.toLowerCase().replace(/&/g, 'and').replace(/juice/g, '');
   const words1 = s1.split(/[^a-z0-9]/).filter(Boolean);
   const words2 = s2.split(/[^a-z0-9]/).filter(Boolean);
   let matches = 0;
   words1.forEach(w1 => {
       if (words2.some(w2 => w2 === w1 || (w2.length > 3 && w1.includes(w2)) || (w1.length > 3 && w2.includes(w1)))) matches++;
   });
   const score = matches / Math.max(words1.length, words2.length);
   return score >= 0.5; // at least 50% of words match
}

const pairs = [
    ["Farmley Cream & Onion", "Farmley Cream and onion"],
    ["Storia Pomegranate", "Storia Pomegranate Juice"],
    ["Coca Cola Diet Coke", "Coca Cola Dite Coke"], 
    ["Haldiram Salted Peanut", "Haldirams Salted peanuts"],
    ["Epigamia Misti Doi", "Epigamia Mishti doi"]
];

pairs.forEach(([a, b]) => {
    console.log(a, "vs", b, "=>", isMatch(a, b) ? "MATCH" : "FAIL");
});
