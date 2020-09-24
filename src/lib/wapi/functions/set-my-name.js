/**
 * Sets current user profile name
 * @param {string} name
 */
export async function setMyName(name) {
  await window.Store.Perfil.setPushname(name);
}
