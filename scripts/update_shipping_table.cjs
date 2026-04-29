const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Complete Mercado Livre Brazil shipping cost table from knowledge-hub/40538
// Format: [weight_lower, weight_upper, price_0_18.99, price_19_48.99, price_49_78.99, price_79_99.99, price_100_119.99, price_120_149.99, price_150_199.99, price_200_plus]
const shippingData = [
  // [weight_lower, weight_upper, 0-18.99, 19-48.99, 49-78.99, 79-99.99, 100-119.99, 120-149.99, 150-199.99, 200+]
  [0, 0.3, 5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95],
  [0.3, 0.5, 5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55],
  [0.5, 1, 6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65],
  [1, 1.5, 6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65],
  [1.5, 2, 6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65],
  [2, 3, 6.35, 7.95, 8.55, 15.75, 18.35, 21.05, 23.65, 26.25],
  [3, 4, 6.45, 8.15, 8.95, 17.05, 19.85, 22.65, 25.55, 28.35],
  [4, 5, 6.55, 8.35, 9.75, 18.45, 21.55, 24.65, 27.75, 30.75],
  [5, 6, 6.65, 8.55, 9.95, 25.45, 28.55, 32.65, 35.75, 39.75],
  [6, 7, 6.75, 8.75, 10.15, 27.05, 31.05, 36.05, 40.05, 44.05],
  [7, 8, 6.85, 8.95, 10.35, 28.85, 33.65, 38.45, 43.25, 48.05],
  [8, 9, 6.95, 9.15, 10.55, 29.65, 34.55, 39.55, 44.45, 49.35],
  [9, 11, 7.05, 9.55, 10.95, 41.25, 48.05, 54.95, 61.75, 68.65],
  [11, 13, 7.15, 9.95, 11.35, 42.15, 49.25, 56.25, 63.25, 70.25],
  [13, 15, 7.25, 10.15, 11.55, 45.05, 52.45, 59.95, 67.45, 74.95],
  [15, 17, 7.35, 10.35, 11.75, 48.55, 56.05, 63.55, 70.75, 78.65],
  [17, 20, 7.45, 10.55, 11.95, 54.75, 63.85, 72.95, 82.05, 91.15],
  [20, 25, 7.65, 10.95, 12.15, 64.05, 75.05, 84.75, 95.35, 105.95],
  [25, 30, 7.75, 11.15, 12.35, 65.95, 75.45, 85.55, 96.25, 106.95],
  [30, 40, 7.85, 11.35, 12.55, 67.75, 78.95, 88.95, 99.15, 107.05],
  [40, 50, 7.95, 11.55, 12.75, 70.25, 81.05, 92.05, 102.55, 110.75],
  [50, 60, 8.05, 11.75, 12.95, 74.95, 86.45, 98.15, 109.35, 118.15],
  [60, 70, 8.15, 11.95, 13.15, 80.25, 92.95, 105.05, 117.15, 126.55],
  [70, 80, 8.25, 12.15, 13.35, 83.95, 97.05, 109.85, 122.45, 132.25],
  [80, 90, 8.35, 12.35, 13.55, 93.25, 107.45, 122.05, 136.05, 146.95],
  [90, 100, 8.45, 12.55, 13.75, 106.55, 123.95, 139.55, 155.55, 167.95],
  [100, 125, 8.55, 12.75, 13.95, 119.25, 138.05, 156.05, 173.95, 187.95],
  [125, 150, 8.65, 12.75, 14.15, 126.55, 146.15, 165.65, 184.65, 199.45],
  [150, 99999, 8.75, 12.95, 14.35, 166.15, 192.45, 217.55, 242.55, 261.95],
];

const priceRanges = [
  [0, 18.99],
  [19, 48.99],
  [49, 78.99],
  [79, 99.99],
  [100, 119.99],
  [120, 149.99],
  [150, 199.99],
  [200, 99999],
];

// Build the flattened rows for the shipping_cost_table sheet
function buildShippingRows() {
  const rows = [];
  for (const row of shippingData) {
    const weightLower = row[0];
    const weightUpper = row[1];
    for (let i = 0; i < priceRanges.length; i++) {
      const cost = row[i + 2];
      rows.push({
        '范围1下限': priceRanges[i][0],
        '范围1上限': priceRanges[i][1],
        '范围2下限': weightLower,
        '范围2上限': weightUpper,
        '输出值': cost,
        'note': `售价R$${priceRanges[i][0]}-${priceRanges[i][1] === 99999 ? '以上' : 'R$' + priceRanges[i][1]}, 重量${weightLower}-${weightUpper === 99999 ? 'kg以上' : weightUpper + 'kg'}`,
      });
    }
  }
  return rows;
}

const files = [
  'docs/excel-rule-engine-example.xlsx',
  'docs/excel-rule-engine-example备份.xlsx',
  'public/examples/excel-rule-engine-example.xlsx',
];

function processExcel(filePath) {
  console.log(`\nProcessing: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  // Check if shipping_cost_table sheet exists
  if (!wb.SheetNames.includes('shipping_cost_table')) {
    console.log('  ERROR: shipping_cost_table sheet not found, skipping');
    return;
  }

  const rows = buildShippingRows();
  console.log(`  Generated ${rows.length} rows for shipping_cost_table`);

  // Create new sheet from the rows
  const headerRow = ['范围1下限', '范围1上限', '范围2下限', '范围2上限', '输出值', 'note'];
  const data = [headerRow];
  for (const row of rows) {
    data.push(headerRow.map(h => row[h]));
  }

  const newWs = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better readability
  newWs['!cols'] = [
    { wch: 12 },  // 范围1下限
    { wch: 12 },  // 范围1上限
    { wch: 12 },  // 范围2下限
    { wch: 12 },  // 范围2上限
    { wch: 10 },  // 输出值
    { wch: 60 },  // note
  ];

  wb.Sheets.shipping_cost_table = newWs;
  XLSX.writeFile(wb, filePath, { bookType: 'xlsx' });
  console.log(`  Saved: ${filePath} (${rows.length} data rows)`);
}

for (const file of files) {
  const fullPath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    processExcel(fullPath);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
}

console.log('\nDone. All example Excel files updated with complete Brazil ML shipping cost table.');
