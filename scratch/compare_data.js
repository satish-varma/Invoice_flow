const fs = require('fs');
const https = require('https');

const userData = `Sr.No	DC No.	HSN Codes	Brand Name	Description	MRP Price	GST%	9/16/2026	9/17/2026	9/18/2026	9/19/2026	9/20/2026	9/21/2026	9/22/2026	9/23/2026	9/24/2026	9/25/2026	9/26/2026	9/27/2026	9/28/2026	9/29/2026	9/30/2026	Total Qty	Total Value
1	BLR056,BLR062	22029920	Storia	Coconut Water	50	5%	510							1350								1860	93000
2		20081920	The Drill	Nimbu Pudina	50	5%																0	0
3		20081920	The Drill	Cheese	50	5%																0	0
4		20081920	The Drill	Sea Salt	50	5%																0	0
5		20081920	The Drill	Peri Peri Lemon	50	5%																0	0
6		22029930	Zumi	Rasmalai	50	5%																0	0
7		21069099	Haldiram	Tasty Nuts	10	5%																0	0
8		4039010	Amul	Buttermilk	15	5%																0	0
9		22029930	Cavins	Masala Chaas	20	5%																0	0
10		22029920	Jersey	Buttermilk	20	5%																0	0
11		22021010	Coca Cola	Sprite	20	5%																0	0
12		22021010	Coca Cola	Thumbs Up	20	5%																0	0
13		22021010	Coca Cola	Coke	20	5%																0	0
14		19053100	Britannia	Good Day Butter	10	5%																0	0
15		19053100	Britannia	Maska Chaska	10	5%																0	0
16		19053100	Cadbury	Oreo	10	5%																0	0
17		18069010	Rite Bite	Cheese Jalapeno	20	5%																0	0
18		20081940	Beyond	Salt & Black Pepper	20	5%																0	0
19		21069099	Shantag	All Mix Khakhra	20	0%																0	0
20		21069099	Healthy Master	Ragi Chips	33	5%																0	0
21		21069099	Healthy Master	Palak Chips	33	5%																0	0
22		21069099	Healthy Master	Mix Veg Chips	33	5%																0	0
23		19053100	Britannia	Strawberry Shake	40	5%																0	0
24		19053100	Britannia	Mariegold	10	5%																0	0
25		21069099	Kairas	Peanut Chikki	23	5%																0	0
26		10082000	Beyond Snacks	Peri Peri  	20	5%																0	0
27		21069099	Haldiram	Soya Sticks	10	5%																0	0
28		21069099	Lay's 	Spanish Tomato	10	5%																0	0
29		22029020	Raw 	Coconut Water	50	5%																0	0
30		22021090	Bindu	Fizz Jeera Masala	10	5%																0	0
31		4039090	Milky Mist	Buttermilk	20	5%																0	0
32		22029990	Heritage	Buttermilk	15	5%																0	0
33		22029920	Epigamia	Chocolate Milkshake	38	5%																0	0
34		22029930	Dodla	Pista Badam Milk	40	5%																0	0
35		22029930	Dodla	Badam Milk	40	5%																0	0
36		21069099	Haldiram	Masala Sev Murmura	10	5%																0	0
37		21069099	Lay's  	Cream and Onion	10	5%																0	0
38		19053100	Mcvities	Butter Cookies	10	5%																0	0
39		19059020	Parle 	Nutricrunch	15	5%																0	0
40		21069099	Healthy Master	Soya Chips	33	5%																0	0
41		21069099	Healthy Master	Oats Chips	33	5%																0	0
42		21069099	Healthy Master	Beetroot Chips	33	5%																0	0
43		22029010	Paperboat	Coconut Water	50	5%																0	0
44		18069010	Yogabar	Nuts & Seeds	50	5%																0	0
45		21069099	Haldiram	Salted Peanuts	10	5%																0	0
46		19053100	Britannia	Vanilla Milkshake	40	5%																0	0
47		19053100	Britannia	Chocolate Milkshake	40	5%																0	0
48		19053100	Britannia	Bourbon Milkshake	35	5%																0	0
49		19053100	Britannia	Milk Bikies	10	5%																0	0
50	BLR056	22029920	Storia	Pomogranate	40	5%	90															90	3600
51	BLR062	22029920	Storia	Banana Milkshake	45	5%								60								60	2700
52		22029920	Storia	Chocolate Milkshake	45	5%																0	0
53		22029920	Storia	Coffee Shake	45	5%																0	0
54	BLR062	22029920	Storia	Mango Shake	45	5%								60								60	2700
55		22029930	Zumi	Chocolate Shake	50	5%																0	0
56		22029930	Zumi	Rose Kulfi Shake	50	5%																0	0
57	BLR062	22029920	Storia	Badam Shake	45	5%								30								30	1350
58		22021010	Coca Cola	Diet Coke	50	40%																0	0
59		22021010	Coca Cola	Sprite	40	40%																0	0
60	BLR058	22021010	Coca Cola	Thumbs Up	40	40%		480														480	19200
61		22021010	Coca Cola	Zero Coke	40	40%																0	0
62		21069099	Haldiram	Bhujiya Sev	10	5%																0	0
63		21069099	Haldiram	Crushed Peanut	10	5%																0	0
64		21069099	Haldiram	Chatpata Matar	10	5%																0	0
65		21069099	Lay's 	Magic Masala	20	5%																0	0
66		21069099	Lay's 	Cream and Onion	20	5%																0	0
67		19053100	Britannia	Good Day Cashew	10	5%																0	0
68		22029920	Tropicana	Appltini	20	5%																0	0
69		22029920	Tropicana	Pomogranate	20	5%																0	0
70		22029920	Tropicana	Litchi	20	5%																0	0
71		19053100	Britannia	Jim Jam	10	5%																0	0
72		19053100	Britannia	Sweet & Salty	10	5%																0	0
73		19054000	Agvit	All Mix Khakhra	20	0%																0	0
74		18069010	Yogabar	Orange Cashew	50	5%																0	0
75		8021200	Happilo Makhana	Hot Peri Peri	30	5%																0	0
76		8021200	Happilo Makhana	Cream and Onion	30	5%																0	0
77		8021200	Happilo Makhana	Chilli Garlic	30	5%																0	0
78		19053290	Too Yummy	Bhoot Chips	20	5%																0	0
79		10082000	Beyond Snacks	Desi Masala	20	5%																0	0
80	BLR057	21069099	Fab Box	Spicy Lemon Chickpeas	47	5%		200														200	9400
81	BLR057	21069099	Fab Box	High Protein Soya Chips	47	5%		200														200	9400
82	BLR057	21069099	Fab Box	Peri peri Ragi Chips	47	5%		200														200	9400
83	BLR061	21069099	Fab Box	Chocochip banana cookies	47	5%							200									200	9400
84	BLR059	21069099	Peping	Pineapple Ginger	30	5%						250										250	7500
85	BLR059	21069099	Peping	Coconut Fennel	30	5%						250										250	7500
86	BLR059	21069099	Peping	Oranage Spearmint	30	5%						250										250	7500
87	BLR060	22021010	Pepsi	Zero Sugar	40	40%							312									312	12480
88	BLR060	22021010	Pepsi	Pepsi	40	40%							360									360	14400
89	BLR060	22021010	Pepsi	Mountain dew	40	40%							240									240	9600
90	BLR062	22029930	Epigamia	Vanilla Milkshake	38	5%								300								300	11400
91	BLR062	22029930	Epigamia	Chocolate Milkshake	38	5%								300								300	11400
92	BLR062	22029930	Epigamia	Strawberry  Milkshake	38	5%								300								300	11400
93	BLR062,BLR063	4031000	Epigamia	Everyday Yogurt	35	5%								96		48						144	5040
94	BLR062, BLR063	4031000	Epigamia	Alphonse Mango	35	5%								96		48						144	5040
95	BLR063,BLR065	4031000	Epigamia	Mishti Doi	35	5%										64			128			192	6720
95	BLR065	4031000	Epigamia	Lichee	35	5%													64			64	2240
95	BLR064	4039010	Akshaykalpa	Plain Butter Milk	29	5%													300			300	8700
95	BLR064	4039010	Akshaykalpa	Spicy Butter Milk	29	5%													300			300	8700`;

const lines = userData.split('\n').filter(l => l.trim() !== '');
const aggData = [];
// Skip header
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  if (cols.length < 24) continue;
  if (cols[0] === 'Total') continue;
  
  const dcs = cols[1].split(',').map(s => s.trim()).filter(Boolean);
  const brand = cols[3];
  const desc = cols[4];
  const qty = parseInt(cols[22], 10);
  const val = parseFloat(cols[23]);
  
  if (qty > 0) {
    aggData.push({ dcs, brand, desc, qty, val, original: lines[i] });
  }
}

console.log("Found " + aggData.length + " non-zero items in aggregator data.");

const extractValue = (field) => {
  if (!field) return null;
  if (field.stringValue) return field.stringValue;
  if (field.integerValue) return parseInt(field.integerValue, 10);
  if (field.doubleValue) return parseFloat(field.doubleValue);
  if (field.booleanValue) return field.booleanValue;
  if (field.timestampValue) return field.timestampValue;
  if (field.arrayValue) return field.arrayValue.values ? field.arrayValue.values.map(extractValue) : [];
  if (field.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      obj[k] = extractValue(v);
    }
    return obj;
  }
  return null;
}

https.get('https://firestore.googleapis.com/v1/projects/invoiceflow-24nxt/databases/(default)/documents/newrelic_challans?pageSize=1000', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    const challans = (data.documents || []).map(d => {
      const parsed = extractValue({ mapValue: { fields: d.fields } });
      parsed.id = d.name.split('/').pop();
      return parsed;
    });
    
    // Filter to September 16-30 and bangalore location
    const filtered = challans.filter(c => {
      if (c.isDeleted) return false;
      if (c.location !== 'bangalore') return false;
      const date = new Date(c.dcDate);
      return date.getFullYear() === 2026 && date.getMonth() === 8 && date.getDate() >= 16;
    });
    
    console.log("Found " + filtered.length + " challans in system for Sep 16-30 2026.");
    
    // Map items from our system
    const ourItems = [];
    filtered.forEach(c => {
      if (c.lineItems) {
        c.lineItems.forEach(item => {
          ourItems.push({
            dcNumber: c.dcNumber,
            dcDate: c.dcDate,
            brand: item.brandName,
            desc: item.itemName,
            qty: item.quantity,
            mrp: item.mrp,
            val: item.quantity * item.mrp
          });
        });
      }
    });
    
    console.log("Found " + ourItems.length + " line items in our system.");
    
    // Compare
    const differences = [];
    
    // Check aggregator items against ours
    aggData.forEach(aggItem => {
      let ourQtyForThis = 0;
      let ourValForThis = 0;
      
      const matchedOurItems = ourItems.filter(item => 
        aggItem.dcs.includes(item.dcNumber) &&
        (item.brand || '').toLowerCase() === (aggItem.brand || '').toLowerCase() &&
        (item.desc || '').toLowerCase() === (aggItem.desc || '').toLowerCase()
      );
      
      matchedOurItems.forEach(i => {
        ourQtyForThis += i.qty;
        ourValForThis += i.val;
      });
      
      if (ourQtyForThis !== aggItem.qty || ourValForThis !== aggItem.val) {
        differences.push({
          dcs: aggItem.dcs,
          item: aggItem.brand + " " + aggItem.desc,
          aggregatorQty: aggItem.qty,
          aggregatorVal: aggItem.val,
          ourQty: ourQtyForThis,
          ourVal: ourValForThis,
          issue: ourQtyForThis === 0 ? "Missing in our system" : "Mismatch"
        });
      }
    });
    
    // Check our items against aggregator
    const aggItemKeys = new Set(aggData.map(a => JSON.stringify({dcs: a.dcs, brand: (a.brand || '').toLowerCase(), desc: (a.desc || '').toLowerCase()})));
    
    ourItems.forEach(ourItem => {
      // Find if this item was in aggregator data
      const matched = aggData.find(a => 
        a.dcs.includes(ourItem.dcNumber) && 
        (a.brand || '').toLowerCase() === (ourItem.brand || '').toLowerCase() &&
        (a.desc || '').toLowerCase() === (ourItem.desc || '').toLowerCase()
      );
      
      if (!matched) {
        differences.push({
          dcs: [ourItem.dcNumber],
          item: ourItem.brand + " " + ourItem.desc,
          aggregatorQty: 0,
          aggregatorVal: 0,
          ourQty: ourItem.qty,
          ourVal: ourItem.val,
          issue: "Missing in aggregator invoice"
        });
      }
    });
    
    if (differences.length === 0) {
      console.log("\\nAll data matches perfectly! No differences found.");
    } else {
      console.log("\\nDifferences found:");
      console.table(differences);
    }
    
    let totalOurVal = ourItems.reduce((acc, curr) => acc + curr.val, 0);
    let totalAggVal = aggData.reduce((acc, curr) => acc + curr.val, 0);
    console.log("\\nTotal Aggregator Value: " + totalAggVal);
    console.log("Total Our Value: " + totalOurVal);
    
  });
});
