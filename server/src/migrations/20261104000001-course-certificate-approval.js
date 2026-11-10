export async function up({ context: { queryInterface, Sequelize } }) {
  const { DataTypes } = Sequelize;
  await queryInterface.addColumn('courses', 'curriculumLocked', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn('courses', 'curriculumLocked');
}
