let active = false

function beginMaintenance() {
  active = true
}

function endMaintenance() {
  active = false
}

function isUnderMaintenance() {
  return active
}

function maintenanceMessage() {
  return 'The system is restoring a backup. Orders and payments are paused.'
}

module.exports = {
  beginMaintenance,
  endMaintenance,
  isUnderMaintenance,
  maintenanceMessage,
}
