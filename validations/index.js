/**
 * Index de validaciones - Exporta todos los schemas
 */

module.exports = {
  auth: require('./auth.validation'),
  reservation: require('./reservation.validation'),
  tour: require('./tour.validation'),
  guide: require('./guide.validation'),
  driver: require('./driver.validation'),
  vehicle: require('./vehicle.validation'),
  emergency: require('./emergency.validation'),
  language: require('./language.validation')
};
