/* Example data for Busy Home: the de Boers in Utrecht (Sam, Eva, Mila who is 8, and Biscuit the dog),
   so people can see every household tool full of life. Dates are relative to today, so there is always
   something coming up. Used by the website demo only; not in any download. Every record carries
   example: true. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);
  const month = (n) => BW.addPeriod(BW.today(), 'month', n);

  BW.houseExamples = {
    settings: {
      suite: 'house', ownerName: 'Sam de Boer', household: 'Eva, Mila (8), Biscuit the dog', address: 'Lindenlaan 8', postcode: '3581 AB', city: 'Utrecht',
      country: 'Netherlands', email: 'sam@example.com', phone: '+31 6 1234 5678', currency: 'EUR',
    },
    async load() {
      const ex = (o) => Object.assign({ id: BW.uid(), example: true }, o);
      const papers = [
        ex({ title: 'Passport Eva', kind: 'id', person: 'Eva', issued: month(-118), expires: day(96), where: 'Blue folder, study', notes: 'Renew at the town hall; book online. Takes about a week.' }),
        ex({ title: 'Passport Sam', kind: 'id', person: 'Sam', issued: month(-40), expires: month(80), where: 'Blue folder, study' }),
        ex({ title: 'ID card Mila', kind: 'id', person: 'Mila', issued: month(-50), expires: day(40), where: 'Blue folder, study', notes: 'Children’s ID cards last 5 years.' }),
        ex({ title: 'Driving licence Sam', kind: 'id', person: 'Sam', expires: month(30), where: 'Wallet' }),
        ex({ title: 'Home and contents insurance policy', kind: 'insurance', person: 'Household', reference: 'HC-204417', issued: month(-22), where: 'Email, and the blue folder',
          notes: 'Contents insured up to €60,000. Excess €250. Bikes covered at home only.', text: 'Policy conditions. Contents cover. Theft from the home after a break-in is covered. Water damage from burst pipes is covered. Excess 250 euro.' }),
        ex({ title: 'Car insurance', kind: 'insurance', person: 'Sam', reference: 'CA-88213', where: 'Email' }),
        ex({ title: 'Rental agreement Lindenlaan 8', kind: 'house', person: 'Household', issued: month(-31), reviewAt: day(150), where: 'Blue folder, study', notes: 'Notice: one month for us. Rent goes up on 1 July.' }),
        ex({ title: 'Tax return 2025', kind: 'money', person: 'Sam', issued: month(-6), tags: 'tax 2025', where: 'Tax office website' }),
        ex({ title: 'Vaccination booklet Mila', kind: 'health', person: 'Mila', where: 'Kitchen drawer' }),
        ex({ title: 'Biscuit’s pet passport', kind: 'pet', person: 'Biscuit', reviewAt: day(25), notes: 'Rabies jab due next month.', where: 'Kitchen drawer' }),
        ex({ title: 'Washing machine manual', kind: 'warranty', person: 'Household', where: 'Laundry cupboard' }),
      ];
      const contracts = [
        ex({ name: 'Home and contents insurance', kind: 'insurance', provider: 'Example Insurance', reference: 'HC-204417', cost: 24.5, per: 'month', end: day(52), renews: 'yes', renewMonths: 12,
          notice: 1, noticeUnit: 'month', address: 'Example Insurance\nPostbus 100\n1000 AA Amsterdam', phone: '020 123 4567', paperId: papers[4].id }),
        ex({ name: 'Energy', kind: 'energy', provider: 'Example Energy', reference: 'EN-55102', cost: 162, per: 'month', end: day(31), renews: 'rolling', notice: 1, noticeUnit: 'month',
          notes: 'Fixed price ends next month, then a variable rate. Compare deals before then.' }),
        ex({ name: 'Internet and TV', kind: 'internet', provider: 'Example Fibre', reference: '7781-22', cost: 59.5, per: 'month', start: month(-26), end: month(-2), renews: 'rolling', notice: 1, noticeUnit: 'month' }),
        ex({ name: 'Gym', kind: 'sport', provider: 'Fit Utrecht', cost: 34.95, per: 'month', end: day(40), renews: 'yes', renewMonths: 12, notice: 4, noticeUnit: 'week',
          address: 'Fit Utrecht\nSportlaan 1\n3500 AA Utrecht', notes: 'Eva barely goes since the new job.' }),
        ex({ name: 'Phone Sam', kind: 'phone', provider: 'Example Mobile', cost: 18, per: 'month', end: month(9), renews: 'rolling', notice: 1, noticeUnit: 'month' }),
        ex({ name: 'Car insurance', kind: 'car', provider: 'Example Insurance', reference: 'CA-88213', cost: 412, per: 'year', end: month(5), renews: 'yes', renewMonths: 12, notice: 1, noticeUnit: 'month', paperId: papers[5].id }),
        ex({ name: 'Streaming', kind: 'streaming', provider: 'Example Stream', cost: 13.99, per: 'month', renews: 'rolling', notice: 0 }),
        ex({ name: 'Swimming lessons Mila', kind: 'membership', provider: 'Swim club', cost: 120, per: 'quarter', end: month(2), renews: 'no' }),
      ];
      const upkeep = [
        ex({ task: 'Service the boiler', area: 'heating', every: 12, last: month(-11), who: 'Example Heating, 030 765 4321', notes: 'Ask them to check the pressure too.', log: [{ date: month(-11), note: 'All fine, new filter', cost: 95 }] }),
        ex({ task: 'Test the smoke alarms', area: 'safety', every: 3, last: month(-4), log: [] }),
        ex({ task: 'Clean the gutters', area: 'outside', every: 12, last: month(-13), who: 'Neighbour’s ladder', log: [] }),
        ex({ task: 'Descale the coffee machine', area: 'appliances', every: 3, last: month(-1), log: [{ date: month(-1), note: '', cost: '' }] }),
        ex({ task: 'Car service', area: 'car', every: 12, last: month(-7), who: 'Garage Oost', log: [{ date: month(-7), note: 'Brake pads front', cost: 389 }] }),
        ex({ task: 'Bleed the radiators', area: 'heating', every: 12, last: month(-12), log: [] }),
      ];
      const inventory = [
        ex({ name: 'TV', room: 'Living room', kind: 'electronics', brand: 'Example', model: '55 inch', bought: month(-20), price: 899, warrantyUntil: day(35), photos: [], receipt: 'Inventory/Living room/TV receipt.pdf' }),
        ex({ name: 'Sofa', room: 'Living room', kind: 'furniture', bought: month(-30), price: 1450, value: 1000, photos: [] }),
        ex({ name: 'Laptop Eva', room: 'Study', kind: 'electronics', brand: 'Example', serial: 'C02XK1', bought: month(-14), price: 1299, photos: [], receipt: 'Inventory/Study/Laptop receipt.pdf' }),
        ex({ name: 'Cargo bike', room: 'Garage', kind: 'bike', brand: 'Example Bikes', serial: 'Frame WB-55210', bought: month(-18), price: 3200, value: 2500, photos: [], notes: 'Insured separately? Check the policy: bikes only at home.' }),
        ex({ name: 'Wedding rings', room: 'Bedroom', kind: 'jewellery', bought: month(-96), price: 1800, value: 2200, photos: [] }),
        ex({ name: 'Washing machine', room: 'Bathroom', kind: 'appliance', brand: 'Example', bought: month(-40), price: 649, photos: [] }),
      ];
      const moves = [];
      const letters = [
        ex({ template: 'cancel', title: 'Cancellation: Gym', to: 'Fit Utrecht', toAddress: 'Fit Utrecht\nSportlaan 1\n3500 AA Utrecht', contractId: contracts[3].id,
          body: BW.house.fill(BW.house.LETTERS[0].body, { me: BW.house.me(this.settings), to: { name: 'Fit Utrecht', address: 'Fit Utrecht\nSportlaan 1\n3500 AA Utrecht' }, c: { name: 'Gym', reference: '', end: day(40) } }) }),
      ];
      const binder = [
        ex({ section: 'people', title: 'Eva’s sister Ilse', text: '06 1111 2222. Knows where everything is and has a spare key.' }),
        ex({ section: 'people', title: 'Notary', text: 'Notary office Example, 030 222 3333. Has our wills.' }),
        ex({ section: 'where', title: 'The blue folder', text: 'Bottom drawer of the desk in the study: passports, the rental agreement, policies.' }),
        ex({ section: 'home', title: 'Stopcock and fuse box', text: 'Stopcock under the kitchen sink. Fuse box in the hallway cupboard, top shelf.' }),
        ex({ section: 'pets', title: 'Biscuit', text: 'Two scoops of dry food morning and evening. Vet: Dierenkliniek Example. Ilse will take him.' }),
      ];
      const put = [['papers', papers], ['contracts', contracts], ['upkeep', upkeep], ['inventory', inventory], ['moves', moves], ['letters', letters], ['binder', binder]];
      for (const [name, list] of put) if (list.length) await BW.store.putMany(name, list);
    },
  };
})();
