function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface ObstetricData {
  gravida: number;
  para: number;
  edd: string;
  gestationalAge: number;
  membranesStatus: 'INTACT' | 'RUPTURED';
  presentationType: 'CEPHALIC' | 'BREECH' | 'TRANSVERSE';
}

export class ObstetricGenerator {
  generate(): ObstetricData {
    const gravida = randomBetween(1, 5);
    const para = randomBetween(0, gravida - 1);
    const weeksPregnant = randomBetween(36, 42);
    const edd = new Date();
    edd.setDate(edd.getDate() + (40 - weeksPregnant) * 7);

    return {
      gravida,
      para,
      edd: edd.toISOString().split('T')[0],
      gestationalAge: weeksPregnant,
      membranesStatus: Math.random() > 0.7 ? 'RUPTURED' : 'INTACT',
      presentationType: Math.random() > 0.85 ? 'BREECH' : 'CEPHALIC',
    };
  }
}
