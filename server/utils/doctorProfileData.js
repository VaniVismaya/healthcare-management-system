const parseIdList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  }

  if (value === undefined || value === null || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        return parseIdList(parsed);
      }
    } catch {
      // Ignore JSON parse issues and try comma splitting instead.
    }

    return [...new Set(
      trimmed
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0)
    )];
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? [numeric] : [];
};

const loadMasterRows = async (pool, table, ids) => {
  if (!ids.length) return [];
  const [rows] = await pool.query(
    `SELECT id, name
     FROM ${table}
     WHERE id IN (?)
     ORDER BY name`,
    [ids]
  );
  return rows;
};

const resolveDoctorProfileFields = async (pool, payload = {}) => {
  const primarySpecializationId = parseIdList(payload.primary_specialization_id)[0] || null;
  const requestedAdditionalIds = parseIdList(payload.additional_specialization_ids);
  const educationIds = parseIdList(payload.education_ids);

  let specialization = String(payload.specialization || '').trim();
  let qualification = String(payload.qualification || '').trim();

  let additionalSpecializationIds = requestedAdditionalIds;
  let additionalSpecializations = [];
  let educations = [];

  if (primarySpecializationId || requestedAdditionalIds.length) {
    const specializationRows = await loadMasterRows(
      pool,
      'medical_specializations',
      [...new Set([primarySpecializationId, ...requestedAdditionalIds].filter(Boolean))]
    );
    const specializationMap = new Map(specializationRows.map((row) => [row.id, row.name]));

    if (primarySpecializationId && specializationMap.has(primarySpecializationId)) {
      specialization = specializationMap.get(primarySpecializationId);
    }

    additionalSpecializationIds = requestedAdditionalIds.filter(
      (id) => id !== primarySpecializationId && specializationMap.has(id)
    );
    additionalSpecializations = additionalSpecializationIds.map((id) => specializationMap.get(id));
  }

  if (educationIds.length) {
    const educationRows = await loadMasterRows(pool, 'medical_educations', educationIds);
    const educationMap = new Map(educationRows.map((row) => [row.id, row.name]));
    const filteredEducationIds = educationIds.filter((id) => educationMap.has(id));
    educations = filteredEducationIds.map((id) => educationMap.get(id));
    qualification = educations.join(', ');
    return {
      primarySpecializationId,
      specialization,
      additionalSpecializationIds,
      additionalSpecializations,
      educationIds: filteredEducationIds,
      educations,
      qualification,
    };
  }

  return {
    primarySpecializationId,
    specialization,
    additionalSpecializationIds,
    additionalSpecializations,
    educationIds,
    educations,
    qualification,
  };
};

module.exports = {
  parseIdList,
  resolveDoctorProfileFields,
};
