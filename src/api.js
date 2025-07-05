"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refactorCode = exports.getComplexity = exports.checkVulnerabilities = void 0;
const axios_1 = __importDefault(require("axios"));
// ✅ Replace with your real deployed backend base URL:
const BASE_URL = 'https://akash-nath29-web--8000.prod1.defang.dev';
async function checkVulnerabilities(code) {
    try {
        const response = await axios_1.default.post(`${BASE_URL}/analyze`, { code }, {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Vulnerabilities API Response:', response.data);
        return response.data;
    }
    catch (error) {
        console.error('❌ Vulnerabilities API Error:', error.message);
        throw new Error('Vulnerability check failed.');
    }
}
exports.checkVulnerabilities = checkVulnerabilities;
async function getComplexity(code) {
    try {
        const response = await axios_1.default.post(`${BASE_URL}/complexity`, { code }, {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Complexity API Response:', response.data);
        return response.data;
    }
    catch (error) {
        console.error('❌ Complexity API Error:', error.message);
        throw new Error('Complexity check failed.');
    }
}
exports.getComplexity = getComplexity;
async function refactorCode(code) {
    try {
        const response = await axios_1.default.post(`${BASE_URL}/refactor`, { code }, {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Refactor API Response:', response.data);
        return response.data.optimized_code || null;
    }
    catch (error) {
        console.error('❌ Refactor API Error:', error.message);
        return null; // If refactor fails, return null — handled in extension
    }
}
exports.refactorCode = refactorCode;
//# sourceMappingURL=api.js.map