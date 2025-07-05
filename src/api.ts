import axios from 'axios';

// ✅ Replace with your real deployed backend base URL:
const BASE_URL = 'https://akash-nath29-web--8000.prod1.defang.dev';

export async function checkVulnerabilities(code: string): Promise<any> {
  try {
    const response = await axios.post(`${BASE_URL}/analyze`, { code }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Vulnerabilities API Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Vulnerabilities API Error:', error.message);
    throw new Error('Vulnerability check failed.');
  }
}

export async function getComplexity(code: string): Promise<any> {
  try {
    const response = await axios.post(`${BASE_URL}/complexity`, { code }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Complexity API Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Complexity API Error:', error.message);
    throw new Error('Complexity check failed.');
  }
}

export async function refactorCode(code: string): Promise<string | null> {
  try {
    const response = await axios.post(`${BASE_URL}/refactor`, { code }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Refactor API Response:', response.data);
    return response.data.optimized_code || null;
  } catch (error: any) {
    console.error('❌ Refactor API Error:', error.message);
    return null; // If refactor fails, return null — handled in extension
  }
}
