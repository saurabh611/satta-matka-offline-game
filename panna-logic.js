// Valid panna numbers for each digit
const pannaList = {
  0: ['127', '136', '145', '190', '235', '280', '370', '389', '460', '479', '569', '578', '118', '226', '244', '299', '334', '488', '668', '677', '000', '550'],
  1: ['137', '128', '146', '236', '245', '290', '380', '470', '489', '560', '678', '579', '119', '155', '227', '335', '344', '399', '588', '669', '777', '100'],
  2: ['129', '138', '147', '156', '237', '246', '345', '390', '480', '570', '589', '679', '110', '228', '255', '336', '499', '660', '688', '778', '200', '444'],
  3: ['120', '139', '148', '157', '238', '247', '256', '346', '490', '580', '670', '689', '166', '229', '337', '355', '445', '599', '779', '788', '300', '111'],
  4: ['130', '149', '158', '167', '239', '248', '257', '347', '356', '590', '680', '789', '112', '220', '266', '338', '446', '455', '699', '770', '400', '888'],
  5: ['140', '159', '168', '230', '249', '258', '267', '348', '357', '456', '690', '780', '113', '122', '177', '339', '366', '447', '799', '889', '500', '555'],
  6: ['123', '150', '169', '178', '240', '259', '268', '349', '358', '367', '457', '790', '114', '277', '330', '448', '466', '556', '880', '899', '600', '222'],
  7: ['124', '160', '179', '250', '269', '278', '340', '359', '368', '458', '467', '890', '115', '133', '188', '223', '377', '449', '557', '566', '700', '999'],
  8: ['125', '134', '170', '189', '260', '279', '350', '369', '378', '459', '468', '567', '116', '224', '233', '288', '440', '477', '558', '990', '800', '666'],
  9: ['126', '135', '180', '234', '270', '289', '360', '379', '450', '469', '478', '568', '117', '144', '199', '225', '388', '559', '577', '667', '900', '333']
};

class PannaLogic {
  static getPannaType(panna) {
    if (!panna || panna.length !== 3) return null;
    
    const digits = panna.split('').map(Number);
    const uniqueDigits = new Set(digits);
    
    if (uniqueDigits.size === 1) {
      return 'triple';
    } else if (uniqueDigits.size === 2) {
      return 'double';
    } else {
      return 'single';
    }
  }

  static getRandomPanna(digit) {
    if (!pannaList[digit]) return null;
    const validPannas = pannaList[digit];
    return validPannas[Math.floor(Math.random() * validPannas.length)];
  }

  static calculatePayout(betType, amount) {
    const multipliers = {
      'single_digit': 9,
      'jodi': 90,
      'single_panna': 150,
      'double_panna': 300,
      'triple_panna': 600
    };
    
    return amount * (multipliers[betType] || 0);
  }

  static validatePanna(panna, digit) {
    if (!pannaList[digit]) return false;
    return pannaList[digit].includes(panna);
  }

  static getJodiFromPannas(openPanna, closePanna) {
    if (!openPanna || !closePanna || openPanna.length !== 3 || closePanna.length !== 3) {
      return null;
    }
    
    return openPanna[0] + closePanna[0];
  }

  static getAllPannasByType(type) {
    const allPannas = Object.values(pannaList).flat();
    return allPannas.filter(panna => this.getPannaType(panna) === type);
  }
}

module.exports = {
  PannaLogic,
  pannaList
};
