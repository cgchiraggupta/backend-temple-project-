const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

class CSVExporter {
  static async exportToCSV(data, filename, headers) {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, `${filename}_${Date.now()}.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: headers
    });

    await csvWriter.writeRecords(data);
    return filepath;
  }

  static async exportFinancialReport(reportData, reportType) {
    let headers, data;

    switch (reportType) {
      case 'donations':
        headers = [
          { id: 'date', title: 'Date' },
          { id: 'source', title: 'Source' },
          { id: 'amount', title: 'Amount' },
          { id: 'donor_email', title: 'Donor Email' },
          { id: 'status', title: 'Status' }
        ];
        data = reportData;
        break;

      case 'expenses':
        headers = [
          { id: 'date', title: 'Date' },
          { id: 'vendor', title: 'Vendor' },
          { id: 'amount', title: 'Amount' },
          { id: 'category', title: 'Category' },
          { id: 'note', title: 'Note' }
        ];
        data = reportData;
        break;

      default:
        throw new Error('Invalid report type');
    }

    return await this.exportToCSV(data, reportType, headers);
  }

  static async exportCommunityMembers(members) {
    const headers = [
      { id: 'full_name', title: 'Name' },
      { id: 'email', title: 'Email' },
      { id: 'phone', title: 'Phone' },
      { id: 'role', title: 'Role' },
      { id: 'status', title: 'Status' },
      { id: 'joined_at', title: 'Joined Date' }
    ];

    const data = members.map(m => ({
      full_name: m.user?.full_name || '',
      email: m.user?.email || '',
      phone: m.user?.phone || '',
      role: m.role,
      status: m.status,
      joined_at: new Date(m.joined_at).toLocaleDateString()
    }));

    return await this.exportToCSV(data, 'community_members', headers);
  }
}

module.exports = CSVExporter;
