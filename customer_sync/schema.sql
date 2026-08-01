CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    activation_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    storage_gb INT NOT NULL
);
