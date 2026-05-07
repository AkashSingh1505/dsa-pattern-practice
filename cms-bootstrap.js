/**
 * Portfolio-style CMS keys (projects / skills / home) are not used on this site.
 * Initializes empty __CMS so shared script.js paths stay safe; DSA graph loads via /api/data?k=dsa in script.js.
 */

async function cmsBootstrap() {
    window.__CMS = {
        projects: [],
        skills: [],
        home: null,
    };
}
