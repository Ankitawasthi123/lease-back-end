export interface CreateWarehouseRequest {
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
  login_id: string;
}

export interface UpdateWarehouseRequest {
  login_id: string;
  id: string;
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
}

export interface DeleteWarehouseRequest {
  login_id: string;
  id: string;
}

export interface WarehouseResponse {
  id: string;
  warehouse_location: object;
  warehouse_size: string;
  warehouse_compliance: object;
  material_details: object;
  login_id: string;
}