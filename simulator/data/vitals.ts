function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number): number {
  const val = min + Math.random() * (max - min);
  return Number(val.toFixed(decimals));
}

export interface Vitals {
  bp: string;
  hr: number;
  rr: number;
  temp: number;
  spo2: number;
  weight?: number;
  height?: number;
}

export interface ErTriageVitals {
  systolic: number;
  diastolic: number;
  HR: number;
  RR: number;
  TEMP: number;
  SPO2: number;
}

export interface IcuVentilatorData {
  mode: string;
  fio2: number;
  tidalVolume: number;
  respiratoryRate: number;
  peep: number;
  pip: number;
  spo2: number;
  etco2: number;
}

export class VitalsGenerator {
  generateNormal(): Vitals {
    const sys = randomBetween(110, 130);
    const dia = randomBetween(70, 85);
    return {
      bp: `${sys}/${dia}`,
      hr: randomBetween(60, 90),
      rr: randomBetween(14, 20),
      temp: randomFloat(36.2, 37.2, 1),
      spo2: randomBetween(96, 100),
      weight: randomBetween(50, 100),
      height: randomBetween(155, 185),
    };
  }

  generateCritical(): Vitals {
    const scenarios = [
      { sys: 190, dia: 110, hr: 105, spo2: 94 },
      { sys: 75, dia: 50, hr: 120, spo2: 88 },
      { sys: 130, dia: 85, hr: 160, spo2: 95 },
      { sys: 120, dia: 80, hr: 72, spo2: 82 },
    ];
    const s = scenarios[Math.floor(Math.random() * scenarios.length)];
    return {
      bp: `${s.sys}/${s.dia}`,
      hr: s.hr,
      rr: randomBetween(22, 32),
      temp: randomFloat(38.0, 40.0, 1),
      spo2: s.spo2,
      weight: randomBetween(50, 100),
      height: randomBetween(155, 185),
    };
  }

  generateErTriage(): ErTriageVitals {
    return {
      systolic: randomBetween(100, 140),
      diastolic: randomBetween(60, 90),
      HR: randomBetween(60, 100),
      RR: randomBetween(14, 22),
      TEMP: randomFloat(36.0, 38.5, 1),
      SPO2: randomBetween(94, 100),
    };
  }

  generateErTriageCritical(): ErTriageVitals {
    return {
      systolic: randomBetween(60, 80),
      diastolic: randomBetween(30, 50),
      HR: randomBetween(120, 160),
      RR: randomBetween(28, 40),
      TEMP: randomFloat(39.0, 41.0, 1),
      SPO2: randomBetween(75, 88),
    };
  }

  generateVentilator(): IcuVentilatorData {
    return {
      mode: ['SIMV', 'AC', 'PS', 'CPAP', 'BiPAP'][Math.floor(Math.random() * 5)],
      fio2: randomBetween(30, 80),
      tidalVolume: randomBetween(350, 550),
      respiratoryRate: randomBetween(12, 24),
      peep: randomBetween(5, 15),
      pip: randomBetween(15, 35),
      spo2: randomBetween(90, 99),
      etco2: randomBetween(30, 45),
    };
  }
}
