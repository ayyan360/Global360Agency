export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  await queryInterface.addColumn('certificate_payment_requests', 'feeAmount', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  await queryInterface.sequelize.query(`
    ALTER TABLE certificate_payment_requests
      ADD CONSTRAINT certificate_payment_fee_amount_check CHECK ("feeAmount" >= 0);
  `);
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn('certificate_payment_requests', 'feeAmount');
}
