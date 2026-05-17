let isAIPaused = false;

export function getIsAIPaused() {
  return isAIPaused;
}

export function setIsAIPaused(val) {
  isAIPaused = Boolean(val);
}
