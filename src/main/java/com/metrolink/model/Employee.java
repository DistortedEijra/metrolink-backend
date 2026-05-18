package com.metrolink.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class Employee {
    private int           id;
    private String        employeeCode;
    private String        fullName;
    private String        position;       // DRIVER | CONDUCTOR
    private BigDecimal    dailyRate;
    private boolean       isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Employee() {}

    public int getId()                        { return id; }
    public void setId(int id)                 { this.id = id; }

    public String getEmployeeCode()           { return employeeCode; }
    public void setEmployeeCode(String v)     { this.employeeCode = v; }

    public String getFullName()               { return fullName; }
    public void setFullName(String v)         { this.fullName = v; }

    public String getPosition()               { return position; }
    public void setPosition(String v)         { this.position = v; }

    public BigDecimal getDailyRate()          { return dailyRate; }
    public void setDailyRate(BigDecimal v)    { this.dailyRate = v; }

    public boolean isActive()                 { return isActive; }
    public void setActive(boolean v)          { this.isActive = v; }

    public LocalDateTime getCreatedAt()       { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }

    public LocalDateTime getUpdatedAt()       { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
}
