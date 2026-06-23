import skusData from '../constants/skus.json';
import type { CustomNode } from '../store/store';

const skus: Record<string, string> = skusData as Record<string, string>;

function resolveOpticSku(opticStr: string, chassisModel: string): string {
  const firstWord = opticStr.split(' ')[0];
  if (firstWord === 'Cable') {
    if (chassisModel.includes('TA200') || chassisModel.includes('HC3')) {
      return 'CBL-505';
    } else if (chassisModel.includes('TA400')) {
      return 'CBL-602';
    }
    return 'CBL-205';
  }
  return firstWord;
}

export interface BomRow {
  sku: string;
  qty: number;
  description: string;
  term?: string;
  type: 'Chassis' | 'Module' | 'Optic' | 'Dependency' | 'TAP';
}

export function generateBom(
  nodes: CustomNode[],
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string
): BomRow[] {
  const rowMap: Record<string, BomRow> = {};

  const addRow = (sku: string, qty: number, type: BomRow['type'], term?: string) => {
    const description = skus[sku] || 'Unknown SKU';
    
    // Check if there are any prerequisites mentioned in description
    const reqMatch = description.match(/(?:requires|Must also add)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    
    if (rowMap[sku]) {
      rowMap[sku].qty += qty;
    } else {
      rowMap[sku] = { sku, qty, description, term, type };
    }

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      let depTerm = undefined;
      if (depSku.endsWith('-SW-TM')) depTerm = term || globalTermDuration;
      
      if (rowMap[depSku]) {
        rowMap[depSku].qty += qty;
      } else {
        rowMap[depSku] = { 
          sku: depSku, 
          qty, 
          description: skus[depSku] || 'Required Dependency', 
          term: depTerm, 
          type: 'Dependency' 
        };
      }
    }
  };

  nodes.forEach(node => {
    if (node.type !== 'hardwareNode') return;
    
    const model = (node.data?.model as string) || '';
    const baseSku = (node.data?.sku as string) || '';
    const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') 
      ? node.data?.licenseModeOverride 
      : globalLicenseMode;
      
    const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
    const power = (node.data?.powerSupply as string) || 'AC';
    const capacity = (node.data?.portCapacity as string) || 'Full';

    let actualHwSku = baseSku;
    
    if (model.includes('HC1') && !model.includes('HC1-Plus')) {
      actualHwSku = power === 'DC' ? 'GVS-HC102' : 'GVS-HC101';
    } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
      actualHwSku = power === 'DC' ? 'GVS-HC1P2' : 'GVS-HC1P1';
    } else if (model.includes('HC3')) {
      actualHwSku = power === 'DC' ? 'GVS-HC3A2' : 'GVS-HC3A1';
    } else if (model.includes('TA25E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAX22E' : 'GVS-TAX21E';
    } else if (model.includes('TA25') && !model.includes('TA25E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAX22' : 'GVS-TAX21';
    } else if (model.includes('TA200E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAC22E' : 'GVS-TAC21E';
    } else if (model.includes('TA200') && !model.includes('TA200E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAC22' : 'GVS-TAC21';
    } else if (model.includes('TA400E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAC42E' : 'GVS-TAC41E';
    } else if (model.includes('TA400') && !model.includes('TA400E')) {
      actualHwSku = power === 'DC' ? 'GVS-TAC42' : 'GVS-TAC41';
    } else if (model.includes('TA10') && !model.includes('TA100')) {
      actualHwSku = power === 'DC' ? 'GVS-TAX02' : 'GVS-TAX01';
    } else if (model.includes('TA100')) {
      actualHwSku = power === 'DC' ? 'GVS-TAC02' : 'GVS-TAC01';
    }

    if (model.includes('TAP')) {
      addRow(actualHwSku, 1, 'TAP');
      return;
    }

    if (licenseMode === 'HTL') {
      const hwSku = actualHwSku + '-HW';
      let swSku = '';

      if (model.includes('HC1') && !model.includes('HC1-Plus')) swSku = 'GVS-HC100-SW-TM';
      else if (model.includes('HC1-Plus') || model.includes('HC1P')) swSku = 'GVS-HC1P-SW-TM';
      else if (model.includes('HC3')) swSku = 'GVS-HC3A0-SW-TM';
      else if (model.includes('TA')) {
         let swBase = actualHwSku;
         if (swBase.includes('TAX21')) swBase = swBase.replace('TAX21', 'TAX20');
         else if (swBase.includes('TAX22')) swBase = swBase.replace('TAX22', 'TAX20');
         else if (swBase.includes('TAC21')) swBase = swBase.replace('TAC21', 'TAC20');
         else if (swBase.includes('TAC22')) swBase = swBase.replace('TAC22', 'TAC20');
         else if (swBase.includes('TAC41')) swBase = swBase.replace('TAC41', 'TAC40');
         else if (swBase.includes('TAC42')) swBase = swBase.replace('TAC42', 'TAC40');
         else swBase = swBase.replace(/1|2/, '0'); // fallback
         
         if (capacity === 'Half') swBase += 'A';
         else if (capacity === 'Quarter') swBase += 'B';
         swSku = swBase + '-SW-TM';
      }

      addRow(hwSku, 1, 'Chassis');
      if (swSku) {
        addRow(swSku, 1, 'Chassis', termOverride);
      }
    } else {
      addRow(actualHwSku, 1, 'Chassis');
    }

    const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
    Object.values(installedBoards).forEach(boardSku => {
      if (!boardSku) return;
      if (licenseMode === 'HTL') {
         addRow(boardSku + '-HW', 1, 'Module');
         addRow(boardSku + '-SW-TM', 1, 'Module', termOverride);
      } else {
         addRow(boardSku, 1, 'Module');
      }
    });

    const optics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
    optics.forEach(opt => {
      if (!opt.optic) return;
      const opticSku = resolveOpticSku(opt.optic, model);
      addRow(opticSku, opt.qty, 'Optic');
    });
  });

  return Object.values(rowMap).sort((a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku));
}
