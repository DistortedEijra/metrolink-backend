package com.metrolink.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class Employee {
    private int           id;
    private String        employeeCode;
    private String        fullName;
    private LocalDate     birthdate;
    private String        address;
    private String        position;
    private BigDecimal    dailyRate;
    private BigDecimal    biMonthlyRate;
    @JsonProperty("isActive")
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

    public LocalDate getBirthdate()           { return birthdate; }
    public void setBirthdate(LocalDate v)     { this.birthdate = v; }

    public String getAddress()                { return address; }
    public void setAddress(String v)          { this.address = v; }

    public String getPosition()               { return position; }
    public void setPosition(String v)         { this.position = v; }

    public BigDecimal getDailyRate()              { return dailyRate; }
    public void setDailyRate(BigDecimal v)        { this.dailyRate = v; }

    public BigDecimal getBiMonthlyRate()          { return biMonthlyRate; }
    public void setBiMonthlyRate(BigDecimal v)    { this.biMonthlyRate = v; }

    @JsonIgnore
    public boolean isActive()                 { return isActive; }
    public void setActive(boolean v)          { this.isActive = v; }

    public LocalDateTime getCreatedAt()       { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }

    public LocalDateTime getUpdatedAt()       { return updatedAt; }
    public void setUpdatedAt(LocalDateTime v) { this.updatedAt = v; }
}
